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
    Role: {
        ADMIN: 'ADMIN',
        BUSINESS: 'BUSINESS',
        CUSTOMER: 'CUSTOMER',
    },
    OrderStatus: {
        PENDING: 'PENDING',
        CONFIRMED: 'CONFIRMED',
        PREPARING: 'PREPARING',
        DELIVERING: 'DELIVERING',
        DELIVERED: 'DELIVERED',
        CANCELLED: 'CANCELLED',
    },
    NotificationType: {
        SYSTEM: 'SYSTEM',
        ORDER: 'ORDER',
        PAYMENT: 'PAYMENT',
        PROMOTION: 'PROMOTION',
        CHAT: 'CHAT',
    },
}));

import { RestaurantService } from './restaurant.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('RestaurantService - createRestaurantRating', () => {
    let service: RestaurantService;
    let prismaService: any;
    let eventEmitter: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findFirst: jest.fn(),
                },
                order: {
                    findFirst: jest.fn(),
                },
                restaurantRating: {
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                    delete: jest.fn(),
                },
            },
        };
        eventEmitter = {
            emit: jest.fn(),
        };

        service = new RestaurantService(
            prismaService,
            {} as any, // auditService mock
            {} as any, // minioService mock
            eventEmitter,
        );
    });

    it('should successfully create a new rating if all rules are satisfied', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 2,
            name: 'Burger Town',
        });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 101,
            userId: 5,
            status: 'DELIVERED',
        });
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce(null);
        prismaService.client.restaurantRating.create.mockResolvedValueOnce({
            id: 12,
            restaurantId: 101,
            userId: 5,
            vote: 5,
            comment: 'Ngon',
            orderId: 162432,
            tags: ['Món ăn ngon'],
        });

        const result = await service.createRestaurantRating(101, 5, {
            orderId: 162432,
            vote: 5,
            comment: 'Ngon',
            tags: ['Món ăn ngon'],
        });

        expect(result).toBeDefined();
        expect(prismaService.client.restaurantRating.create).toHaveBeenCalledWith({
            data: {
                restaurantId: 101,
                userId: 5,
                vote: 5,
                comment: 'Ngon',
                orderId: 162432,
                tags: ['Món ăn ngon'],
            },
        });
        expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.any(Object));
    });

    it('should throw NotFoundException if restaurant does not exist or is not approved', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if order does not exist', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if order does not belong to the user', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 101,
            userId: 99, // belongs to user 99, but user 5 is rating
            status: 'DELIVERED',
        });

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if order does not belong to the restaurant', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 999, // order is for restaurant 999, but rating is for 101
            userId: 5,
            status: 'DELIVERED',
        });

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if order status is not DELIVERED', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 101,
            userId: 5,
            status: 'PREPARING',
        });

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if order has already been rated', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 101,
            userId: 5,
            status: 'DELIVERED',
        });
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            orderId: 162432,
        });

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if invalid review tags are provided', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 101,
            userId: 5,
            status: 'DELIVERED',
        });
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
                tags: ['Giao quá trễ'], // invalid tag
            }),
        ).rejects.toThrow(BadRequestException);
    });
});

describe('RestaurantService - updateRestaurantRating', () => {
    let service: RestaurantService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurantRating: {
                    findFirst: jest.fn(),
                    update: jest.fn(),
                },
            },
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('should successfully update review fields if user is the owner', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 5,
        });
        prismaService.client.restaurantRating.update.mockResolvedValueOnce({
            id: 12,
            userId: 5,
            vote: 4,
            comment: 'Ngon nhưng giao hơi chậm',
            tags: ['Món ăn ngon'],
        });

        const result = await service.updateRestaurantRating(12, 5, {
            vote: 4,
            comment: 'Ngon nhưng giao hơi chậm',
            tags: ['Món ăn ngon'],
        });

        expect(result.vote).toBe(4);
        expect(prismaService.client.restaurantRating.update).toHaveBeenCalledWith({
            where: { id: 12 },
            data: {
                vote: 4,
                comment: 'Ngon nhưng giao hơi chậm',
                tags: ['Món ăn ngon'],
            },
        });
    });

    it('should throw NotFoundException if review does not exist', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.updateRestaurantRating(12, 5, {
                vote: 4,
            }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner of the review', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 99, // user 99 owns it, but user 5 wants to update
        });

        await expect(
            service.updateRestaurantRating(12, 5, {
                vote: 4,
            }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if invalid review tags are provided', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 5,
        });

        await expect(
            service.updateRestaurantRating(12, 5, {
                tags: ['Giao quá trễ'],
            }),
        ).rejects.toThrow(BadRequestException);
    });
});

describe('RestaurantService - deleteRestaurantRating', () => {
    let service: RestaurantService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurantRating: {
                    findFirst: jest.fn(),
                    delete: jest.fn(),
                },
            },
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('should successfully delete review if user is the owner', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 5,
        });

        const result = await service.deleteRestaurantRating(12, 5, ['CUSTOMER']);

        expect(result.success).toBe(true);
        expect(prismaService.client.restaurantRating.delete).toHaveBeenCalledWith({
            id: 12,
        });
    });

    it('should successfully delete review if user is an ADMIN (even if not owner)', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 99, // belongs to user 99, but deleted by ADMIN
        });

        const result = await service.deleteRestaurantRating(12, 5, ['ADMIN']);

        expect(result.success).toBe(true);
        expect(prismaService.client.restaurantRating.delete).toHaveBeenCalledWith({
            id: 12,
        });
    });

    it('should throw NotFoundException if review does not exist', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.deleteRestaurantRating(12, 5, ['CUSTOMER']),
        ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner and not an ADMIN', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 99,
        });

        await expect(
            service.deleteRestaurantRating(12, 5, ['CUSTOMER']),
        ).rejects.toThrow(ForbiddenException);
    });
});

describe('RestaurantService - getRestaurantRatingsForVendor', () => {
    let service: RestaurantService;
    let prismaService: any;
    let minioService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findFirst: jest.fn(),
                },
                restaurantRating: {
                    findMany: jest.fn(),
                },
            },
        };
        minioService = {
            getFileUrl: jest.fn(async (file) => `http://localhost/${file}`),
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            minioService,
            {} as any,
        );
    });

    it('should successfully return restaurant reviews for the restaurant owner', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 2,
        });

        prismaService.client.restaurantRating.findMany.mockResolvedValueOnce([
            {
                id: 12,
                vote: 5,
                comment: 'Ngon',
                tags: ['Món ăn ngon'],
                createdAt: new Date(),
                reply: null,
                orderId: 162432,
                user: {
                    id: 5,
                    name: 'Nguyen Van A',
                    avatar: 'avatar.jpg',
                },
            },
        ]);

        const result = await service.getRestaurantRatingsForVendor(101, 2, ['BUSINESS']);

        expect(result.length).toBe(1);
        expect(result[0].user.avatar).toBe('http://localhost/avatar.jpg');
        expect(prismaService.client.restaurantRating.findMany).toHaveBeenCalledWith({
            where: {
                restaurantId: 101,
                deleteAt: null,
            },
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        });
    });

    it('should throw ForbiddenException if user is not the owner and not an admin', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 2,
        });

        await expect(
            service.getRestaurantRatingsForVendor(101, 99, ['BUSINESS']),
        ).rejects.toThrow(ForbiddenException);
    });
});

describe('RestaurantService - getRestaurantRatingStats', () => {
    let service: RestaurantService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findFirst: jest.fn(),
                },
                restaurantRating: {
                    findMany: jest.fn(),
                },
            },
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('should successfully calculate stats from ratings list', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 2,
        });

        prismaService.client.restaurantRating.findMany.mockResolvedValueOnce([
            { vote: 5, tags: ['Món ăn ngon', 'Giao hàng nhanh'] },
            { vote: 5, tags: ['Món ăn ngon'] },
            { vote: 3, tags: ['Giao hàng nhanh'] },
        ]);

        const result = await service.getRestaurantRatingStats(101, 2, ['BUSINESS']);

        expect(result).toEqual({
            averageRating: 4.3,
            totalReviews: 3,
            starCount: {
                '1': 0,
                '2': 0,
                '3': 1,
                '4': 0,
                '5': 2,
            },
            popularTags: [
                { tag: 'Món ăn ngon', count: 2 },
                { tag: 'Giao hàng nhanh', count: 2 },
            ],
        });
    });

    it('should throw ForbiddenException if user is not authorized', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 2,
        });

        await expect(
            service.getRestaurantRatingStats(101, 99, ['BUSINESS']),
        ).rejects.toThrow(ForbiddenException);
    });
});

describe('RestaurantService - getAllRestaurants', () => {
    let service: RestaurantService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findMany: jest.fn(),
                },
                userFavoriteRestaurant: {
                    findMany: jest.fn(),
                },
            },
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('should return list of restaurants with isLiked: false if userId is not provided', async () => {
        const mockRestaurants = [
            {
                id: 101,
                name: 'Pizza Shop',
                image: 'pizza.jpg',
                deliveryFee: 1.5,
                ratings: [],
                foods: [],
                createdAt: new Date(),
            },
        ];

        prismaService.client.restaurant.findMany.mockResolvedValueOnce(mockRestaurants);

        const result = await service.getAllRestaurants(20, 0, '', undefined, undefined, undefined, undefined, undefined);

        expect(result).toHaveLength(1);
        expect(result[0].isLiked).toBe(false);
    });

    it('should return list of restaurants with correct isLiked value if userId is provided', async () => {
        const mockRestaurants = [
            {
                id: 101,
                name: 'Pizza Shop',
                image: 'pizza.jpg',
                deliveryFee: 1.5,
                ratings: [],
                foods: [],
                createdAt: new Date(),
            },
            {
                id: 102,
                name: 'Burger Shop',
                image: 'burger.jpg',
                deliveryFee: 2.0,
                ratings: [],
                foods: [],
                createdAt: new Date(),
            },
        ];

        const mockFavorites = [
            { restaurantId: 101 },
        ];

        prismaService.client.restaurant.findMany.mockResolvedValueOnce(mockRestaurants);
        prismaService.client.userFavoriteRestaurant.findMany.mockResolvedValueOnce(mockFavorites);

        const result = await service.getAllRestaurants(20, 0, '', undefined, undefined, undefined, undefined, undefined, 5);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe(101);
        expect(result[0].isLiked).toBe(true);
        expect(result[1].id).toBe(102);
        expect(result[1].isLiked).toBe(false);

        expect(prismaService.client.userFavoriteRestaurant.findMany).toHaveBeenCalledWith({
            where: {
                userId: 5,
                restaurantId: { in: [101, 102] },
            },
            select: { restaurantId: true },
        });
    });
});
