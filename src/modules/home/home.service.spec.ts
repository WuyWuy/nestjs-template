jest.mock('@prisma/client', () => ({
    Prisma: {
        defineExtension: jest.fn((extension) => extension),
        getExtensionContext: jest.fn(),
        TransactionIsolationLevel: {},
    },
    PrismaClient: class {
        $extends() {
            return this;
        }
    },
}));

import { HomeService } from './home.service';

describe('HomeService', () => {
    let service: HomeService;
    let prismaService: any;
    let categoryService: any;
    let restaurantService: any;
    let minioService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                cart: {
                    findFirst: jest.fn(),
                },
                cartItem: {
                    aggregate: jest.fn(),
                },
                message: {
                    count: jest.fn(),
                },
                user: {
                    findFirst: jest.fn(),
                },
                userAddress: {
                    findMany: jest.fn(),
                },
            },
        };

        categoryService = {
            getCategories: jest.fn(),
        };

        restaurantService = {
            getAllRestaurants: jest.fn(),
        };

        minioService = {
            getFileUrl: jest.fn(),
        };

        service = new HomeService(
            prismaService,
            categoryService,
            restaurantService,
            minioService,
        );
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getCounters', () => {
        it('should return 0 counters when user has no cart and no unread messages', async () => {
            prismaService.client.cart.findFirst.mockResolvedValueOnce(null);
            prismaService.client.message.count.mockResolvedValueOnce(0);

            const result = await service.getCounters(1);

            expect(result).toEqual({
                cartItemCount: 0,
                unreadMessageCount: 0,
            });
            expect(prismaService.client.cart.findFirst).toHaveBeenCalledWith({
                where: { userId: 1 },
                select: { id: true },
            });
        });

        it('should return correct counters when cart items and unread messages exist', async () => {
            prismaService.client.cart.findFirst.mockResolvedValueOnce({ id: 10 });
            prismaService.client.cartItem.aggregate.mockResolvedValueOnce({
                _sum: { quantity: 5 },
            });
            prismaService.client.message.count.mockResolvedValueOnce(3);

            const result = await service.getCounters(1);

            expect(result).toEqual({
                cartItemCount: 5,
                unreadMessageCount: 3,
            });
            expect(prismaService.client.cartItem.aggregate).toHaveBeenCalledWith({
                where: { cartId: 10 },
                _sum: { quantity: true },
            });
            expect(prismaService.client.message.count).toHaveBeenCalledWith({
                where: {
                    isRead: false,
                    senderId: { not: 1 },
                    conversation: {
                        OR: [
                            { customerId: 1 },
                            { sellerId: 1 },
                        ],
                    },
                },
            });
        });

        it('should default cart item count to zero when aggregate sum is null', async () => {
            prismaService.client.cart.findFirst.mockResolvedValueOnce({ id: 10 });
            prismaService.client.cartItem.aggregate.mockResolvedValueOnce({
                _sum: { quantity: null },
            });
            prismaService.client.message.count.mockResolvedValueOnce(1);

            const result = await service.getCounters(1);

            expect(result).toEqual({
                cartItemCount: 0,
                unreadMessageCount: 1,
            });
        });
    });

    describe('getDashboard', () => {
        const mockCategories = [
            { id: 1, name: 'Burger', image: 'burger.png' },
            { id: 2, name: 'Pizza', image: 'pizza.png' },
        ];

        const mockRestaurants = [
            {
                id: 101,
                name: 'Burger Town',
                image: 'burger_town.png',
                averageRating: 4.8,
                ratingCount: 120,
                deliveryFee: 15000,
                distanceKm: 2.3,
                categories: [{ id: 1, name: 'Burger' }],
                estimatedDeliveryTime: 25,
                isLiked: true,
            },
        ];

        beforeEach(() => {
            categoryService.getCategories.mockResolvedValue(mockCategories);
            restaurantService.getAllRestaurants.mockResolvedValue(mockRestaurants);
            minioService.getFileUrl.mockImplementation(async (file: string) => `http://localhost/${file}`);
        });

        it('should return dashboard data for guest user (no userId provided)', async () => {
            const result = await service.getDashboard(10.123, 106.123);

            expect(result.user).toBeNull();
            expect(result.counters).toEqual({
                cartItemCount: 0,
                unreadMessageCount: 0,
            });
            expect(result.addresses).toEqual([]);
            expect(result.categories).toEqual([
                { id: 1, name: 'Burger', imageUrl: 'burger.png' },
                { id: 2, name: 'Pizza', imageUrl: 'pizza.png' },
            ]);
            expect(result.restaurants).toEqual([
                {
                    id: 101,
                    name: 'Burger Town',
                    imageUrl: 'http://localhost/burger_town.png',
                    averageRating: 4.8,
                    reviewCount: 120,
                    deliveryFee: 15000,
                    distance: 2.3,
                    tags: ['Burger'],
                    estimatedDeliveryTime: 25,
                    isLiked: true,
                },
            ]);
            expect(categoryService.getCategories).toHaveBeenCalledWith({ limit: 10 });
            expect(restaurantService.getAllRestaurants).toHaveBeenCalledWith(
                20,
                0,
                '',
                undefined,
                10.123,
                106.123,
                undefined,
                'DISTANCE',
                undefined,
            );
            expect(prismaService.client.userAddress.findMany).not.toHaveBeenCalled();
        });

        it('should return dashboard data with user profile and counters for logged-in user', async () => {
            prismaService.client.user.findFirst.mockResolvedValueOnce({
                id: 1,
                name: 'Nguyen Van A',
                avatar: 'avatar.png',
                phone: '0901234567',
            });
            prismaService.client.userAddress.findMany.mockResolvedValueOnce([
                {
                    id: 10,
                    title: 'Home',
                    address: {
                        fullText:
                            '123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City',
                    },
                },
                {
                    id: 11,
                    title: 'Work',
                    address: {
                        fullText:
                            '45 Vo Van Tan, Ward 6, District 3, Ho Chi Minh City',
                    },
                },
            ]);
            prismaService.client.cart.findFirst.mockResolvedValueOnce({ id: 10 });
            prismaService.client.cartItem.aggregate.mockResolvedValueOnce({
                _sum: { quantity: 2 },
            });
            prismaService.client.message.count.mockResolvedValueOnce(4);

            const result = await service.getDashboard(undefined, undefined, 1);

            expect(result.user).toEqual({
                id: 1,
                fullName: 'Nguyen Van A',
                avatarUrl: 'http://localhost/avatar.png',
                phone: '0901234567',
            });
            expect(result.addresses).toEqual([
                {
                    id: 10,
                    title: 'Home',
                    fullText:
                        '123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City',
                },
                {
                    id: 11,
                    title: 'Work',
                    fullText:
                        '45 Vo Van Tan, Ward 6, District 3, Ho Chi Minh City',
                },
            ]);
            expect(result.counters).toEqual({
                cartItemCount: 2,
                unreadMessageCount: 4,
            });
            expect(result.categories).toEqual([
                { id: 1, name: 'Burger', imageUrl: 'burger.png' },
                { id: 2, name: 'Pizza', imageUrl: 'pizza.png' },
            ]);
            expect(result.restaurants).toEqual([
                {
                    id: 101,
                    name: 'Burger Town',
                    imageUrl: 'http://localhost/burger_town.png',
                    averageRating: 4.8,
                    reviewCount: 120,
                    deliveryFee: 15000,
                    distance: 2.3,
                    tags: ['Burger'],
                    estimatedDeliveryTime: 25,
                    isLiked: true,
                },
            ]);
            expect(restaurantService.getAllRestaurants).toHaveBeenCalledWith(
                20,
                0,
                '',
                undefined,
                undefined,
                undefined,
                undefined,
                undefined,
                1,
            );
            expect(prismaService.client.user.findFirst).toHaveBeenCalledWith({
                where: { id: 1 },
                select: {
                    id: true,
                    name: true,
                    avatar: true,
                    phone: true,
                },
            });
            expect(prismaService.client.userAddress.findMany).toHaveBeenCalledWith({
                where: { userId: 1, deleteAt: null },
                select: {
                    id: true,
                    title: true,
                    address: {
                        select: {
                            fullText: true,
                        },
                    },
                },
                orderBy: {
                    id: 'asc',
                },
            });
        });

        it('should not resolve already absolute image urls through Minio', async () => {
            prismaService.client.user.findFirst.mockResolvedValueOnce({
                id: 1,
                name: 'Nguyen Van A',
                avatar: 'https://cdn.example.com/avatar.png',
                phone: null,
            });
            prismaService.client.userAddress.findMany.mockResolvedValueOnce([]);
            prismaService.client.cart.findFirst.mockResolvedValueOnce(null);
            prismaService.client.message.count.mockResolvedValueOnce(0);
            restaurantService.getAllRestaurants.mockResolvedValueOnce([
                {
                    id: 102,
                    name: 'Pizza Place',
                    image: 'https://cdn.example.com/pizza.png',
                    averageRating: 4.2,
                    ratingCount: undefined,
                    deliveryFee: 12000,
                    distanceKm: undefined,
                    categories: [{ id: 2, name: 'Pizza' }],
                    estimatedDeliveryTime: 30,
                    isLiked: undefined,
                },
            ]);

            const result = await service.getDashboard(undefined, undefined, 1);

            expect(minioService.getFileUrl).not.toHaveBeenCalledWith(
                'https://cdn.example.com/avatar.png',
            );
            expect(result.user).toEqual({
                id: 1,
                fullName: 'Nguyen Van A',
                avatarUrl: 'https://cdn.example.com/avatar.png',
                phone: '',
            });
            expect(result.restaurants[0]).toEqual({
                id: 102,
                name: 'Pizza Place',
                imageUrl: 'https://cdn.example.com/pizza.png',
                averageRating: 4.2,
                reviewCount: 0,
                deliveryFee: 12000,
                distance: undefined,
                tags: ['Pizza'],
                estimatedDeliveryTime: 30,
                isLiked: false,
            });
        });

        it('should return empty image urls when file resolution fails or image is missing', async () => {
            restaurantService.getAllRestaurants.mockResolvedValueOnce([
                {
                    id: 103,
                    name: 'Noodle Shop',
                    image: 'broken-image.png',
                    averageRating: 4,
                    ratingCount: 0,
                    deliveryFee: 10000,
                    distanceKm: 1.5,
                    categories: [],
                    estimatedDeliveryTime: 20,
                },
                {
                    id: 104,
                    name: 'Soup Shop',
                    image: null,
                    averageRating: 3.5,
                    ratingCount: undefined,
                    deliveryFee: 9000,
                    distanceKm: 2,
                    categories: [],
                    estimatedDeliveryTime: 18,
                },
            ]);
            minioService.getFileUrl.mockRejectedValueOnce(
                new Error('minio unavailable'),
            );

            const result = await service.getDashboard();

            expect(result.restaurants).toEqual([
                {
                    id: 103,
                    name: 'Noodle Shop',
                    imageUrl: '',
                    averageRating: 4,
                    reviewCount: 0,
                    deliveryFee: 10000,
                    distance: 1.5,
                    tags: [],
                    estimatedDeliveryTime: 20,
                    isLiked: false,
                },
                {
                    id: 104,
                    name: 'Soup Shop',
                    imageUrl: '',
                    averageRating: 3.5,
                    reviewCount: 0,
                    deliveryFee: 9000,
                    distance: 2,
                    tags: [],
                    estimatedDeliveryTime: 18,
                    isLiked: false,
                },
            ]);
        });
    });
});
