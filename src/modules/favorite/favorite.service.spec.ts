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

import { FavoriteService } from './favorite.service';

describe('FavoriteService', () => {
    let service: FavoriteService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findUnique: jest.fn(),
                },
                userFavoriteRestaurant: {
                    findUnique: jest.fn(),
                    create: jest.fn(),
                    delete: jest.fn(),
                    count: jest.fn(),
                    findMany: jest.fn(),
                },
            },
        };

        service = new FavoriteService(prismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('toggleFavorite', () => {
        it('should throw NotFoundException if restaurant does not exist', async () => {
            prismaService.client.restaurant.findUnique.mockResolvedValueOnce(null);

            await expect(
                service.toggleFavorite(1, 101),
            ).rejects.toThrow('Restaurant not found');

            expect(prismaService.client.restaurant.findUnique).toHaveBeenCalledWith({
                where: { id: 101 },
            });
        });

        it('should add to favorite and return isLiked: true if not liked before', async () => {
            prismaService.client.restaurant.findUnique.mockResolvedValueOnce({ id: 101 });
            prismaService.client.userFavoriteRestaurant.findUnique.mockResolvedValueOnce(null);
            prismaService.client.userFavoriteRestaurant.create.mockResolvedValueOnce({ id: 1, userId: 1, restaurantId: 101 });
            prismaService.client.userFavoriteRestaurant.count.mockResolvedValueOnce(15);

            const result = await service.toggleFavorite(1, 101);

            expect(prismaService.client.userFavoriteRestaurant.findUnique).toHaveBeenCalledWith({
                where: {
                    userId_restaurantId: {
                        userId: 1,
                        restaurantId: 101,
                    },
                },
            });
            expect(prismaService.client.userFavoriteRestaurant.create).toHaveBeenCalledWith({
                data: {
                    userId: 1,
                    restaurantId: 101,
                },
            });
            expect(prismaService.client.userFavoriteRestaurant.count).toHaveBeenCalledWith({
                where: { restaurantId: 101 },
            });
            expect(result).toEqual({
                restaurantId: 101,
                isLiked: true,
                totalLikes: 15,
            });
        });

        it('should remove from favorite and return isLiked: false if already liked', async () => {
            prismaService.client.restaurant.findUnique.mockResolvedValueOnce({ id: 101 });
            prismaService.client.userFavoriteRestaurant.findUnique.mockResolvedValueOnce({ id: 1, userId: 1, restaurantId: 101 });
            prismaService.client.userFavoriteRestaurant.delete.mockResolvedValueOnce({ id: 1, userId: 1, restaurantId: 101 });
            prismaService.client.userFavoriteRestaurant.count.mockResolvedValueOnce(14);

            const result = await service.toggleFavorite(1, 101);

            expect(prismaService.client.userFavoriteRestaurant.findUnique).toHaveBeenCalledWith({
                where: {
                    userId_restaurantId: {
                        userId: 1,
                        restaurantId: 101,
                    },
                },
            });
            expect(prismaService.client.userFavoriteRestaurant.delete).toHaveBeenCalledWith({
                userId_restaurantId: {
                    userId: 1,
                    restaurantId: 101,
                },
            });
            expect(prismaService.client.userFavoriteRestaurant.count).toHaveBeenCalledWith({
                where: { restaurantId: 101 },
            });
            expect(result).toEqual({
                restaurantId: 101,
                isLiked: false,
                totalLikes: 14,
            });
        });
    });

    describe('getFavorites', () => {
        it('should return empty list with zero total when user has no favorites', async () => {
            prismaService.client.userFavoriteRestaurant.count.mockResolvedValueOnce(0);
            prismaService.client.userFavoriteRestaurant.findMany.mockResolvedValueOnce([]);

            const result = await service.getFavorites(1, 20, 0);

            expect(result).toEqual({
                data: [],
                pagination: {
                    total: 0,
                    limit: 20,
                    offset: 0,
                },
            });
        });

        it('should return mapped favorites list with averageRating and categories tags', async () => {
            const mockFavorites = [
                {
                    restaurant: {
                        id: 101,
                        name: 'Pizza Shop',
                        image: 'pizza.jpg',
                        deliveryFee: 1.5,
                        ratings: [
                            { vote: 4 },
                            { vote: 5 },
                        ],
                        foods: [
                            { category: { name: 'Pizza' } },
                            { category: { name: 'Fast Food' } },
                            { category: { name: 'Pizza' } }, // Duplicate tag to verify unique logic
                        ],
                    },
                },
            ];

            prismaService.client.userFavoriteRestaurant.count.mockResolvedValueOnce(1);
            prismaService.client.userFavoriteRestaurant.findMany.mockResolvedValueOnce(mockFavorites);

            const result = await service.getFavorites(1, 20, 0);

            expect(prismaService.client.userFavoriteRestaurant.findMany).toHaveBeenCalledWith({
                where: { userId: 1 },
                skip: 0,
                take: 20,
                select: {
                    restaurant: {
                        select: {
                            id: true,
                            name: true,
                            image: true,
                            deliveryFee: true,
                            ratings: {
                                select: {
                                    vote: true,
                                },
                            },
                            foods: {
                                select: {
                                    category: {
                                        select: {
                                            name: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            });

            expect(result).toEqual({
                data: [
                    {
                        id: 101,
                        name: 'Pizza Shop',
                        image: 'pizza.jpg',
                        rating: 4.5,
                        deliveryFee: 1.5,
                        tags: ['Pizza', 'Fast Food'],
                        isLiked: true,
                    },
                ],
                pagination: {
                    total: 1,
                    limit: 20,
                    offset: 0,
                },
            });
        });
    });

    describe('getLikeStatus', () => {
        it('should return isLiked: false if favorite does not exist', async () => {
            prismaService.client.userFavoriteRestaurant.findUnique.mockResolvedValueOnce(null);

            const result = await service.getLikeStatus(1, 101);

            expect(prismaService.client.userFavoriteRestaurant.findUnique).toHaveBeenCalledWith({
                where: {
                    userId_restaurantId: {
                        userId: 1,
                        restaurantId: 101,
                    },
                },
            });
            expect(result).toEqual({ isLiked: false });
        });

        it('should return isLiked: true if favorite exists', async () => {
            prismaService.client.userFavoriteRestaurant.findUnique.mockResolvedValueOnce({ id: 1 });

            const result = await service.getLikeStatus(1, 101);

            expect(result).toEqual({ isLiked: true });
        });
    });
});
