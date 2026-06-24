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
    AuthProvider: {
        LOCAL: 'LOCAL',
        FACEBOOK: 'FACEBOOK',
        GOOGLE: 'GOOGLE',
    },
    OTPType: {
        RESET_PASSWORD_OTP: 'RESET_PASSWORD_OTP',
        RESET_EMAIL_OTP: 'RESET_EMAIL_OTP',
        VERIFY_OTP: 'VERIFY_OTP',
    },
    Role: {
        CUSTOMER: 'CUSTOMER',
    },
    RestaurantApprovalStatus: {
        PENDING: 'PENDING',
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
    },
    TokenType: {
        ACCESS: 'ACCESS',
        REFRESH: 'REFRESH',
    },
}));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search.dto';

describe('SearchService', () => {
    let service: SearchService;
    let prismaService: any;
    let tx: any;

    beforeEach(() => {
        tx = {
            searchHistory: {
                deleteMany: jest.fn(),
                delete: jest.fn(),
            },
        };
        prismaService = {
            client: {
                food: {
                    findMany: jest.fn(),
                },
                restaurant: {
                    findMany: jest.fn(),
                },
                voucher: {
                    findMany: jest.fn(),
                },
                restaurantRating: {
                    groupBy: jest.fn(),
                },
                searchHistory: {
                    findMany: jest.fn(),
                    upsert: jest.fn(),
                    deleteMany: jest.fn(),
                    findFirst: jest.fn(),
                    groupBy: jest.fn(),
                    delete: jest.fn(),
                },
                orderFood: {
                    groupBy: jest.fn(),
                },
            },
            transaction: jest.fn(async (callback) => callback(tx)),
        };

        service = new SearchService(prismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('search', () => {
        it('should return search results for foods and restaurants with proper structures', async () => {
            const mockNow = new Date();
            // Mock Vouchers
            prismaService.client.voucher.findMany.mockResolvedValueOnce([
                { id: 1, restaurantId: 101, type: 'PERCENT', sale: 15, status: 'APPLYING', startAt: null, endAt: null },
            ]);
            // Mock Sold Counts
            prismaService.client.orderFood.groupBy.mockResolvedValueOnce([
                { foodId: 1, _sum: { quantity: 10 } },
            ]);
            // Mock Avg Ratings
            prismaService.client.restaurantRating.groupBy.mockResolvedValueOnce([
                { restaurantId: 101, _avg: { vote: 4.5 } },
            ]);

            // Mock Foods findMany
            prismaService.client.food.findMany.mockResolvedValueOnce([
                {
                    id: 1,
                    name: 'Burger Phô Mai',
                    price: 50.0,
                    image: 'burger.jpg',
                    restaurantId: 101,
                    rating: 4,
                    label: 'Hot',
                    updatedAt: mockNow,
                    restaurant: {
                        name: 'Burger Town',
                        address: { latitude: 10.7, longitude: 106.6 },
                    },
                    ratings: [{ vote: 5 }],
                },
            ]);

            // Mock Restaurants findMany
            prismaService.client.restaurant.findMany.mockResolvedValueOnce([
                {
                    id: 101,
                    name: 'Burger Town',
                    image: 'burger-town.jpg',
                    deliveryFee: 1.5,
                    createdAt: mockNow,
                    address: { latitude: 10.7, longitude: 106.6 },
                    foods: [
                        { category: { name: 'Fast Food' } },
                    ],
                },
            ]);

            const query: SearchQueryDto = {
                q: 'burger',
                lat: 10.71,
                lng: 106.61,
                sort: 'rating',
            };

            const result = await service.search(query);
            expect(result.foods.length).toBe(1);
            expect(result.foods[0].name).toBe('Burger Phô Mai');
            expect(result.foods[0].rating).toBe(5); // Calculated from ratings average
            expect(result.foods[0].promoTag).toBe('Giảm 15%');
            expect(result.foods[0].soldCount).toBe(10);
            
            expect(result.restaurants.length).toBe(1);
            expect(result.restaurants[0].name).toBe('Burger Town');
            expect(result.restaurants[0].averageRating).toBe(4.5);
            expect(result.restaurants[0].hasVoucher).toBe(true);
            expect(result.restaurants[0].tags).toContain('Fast Food');
        });

        it('should apply category filters, sort foods by price, paginate results and omit food distance metadata', async () => {
            prismaService.client.voucher.findMany.mockResolvedValueOnce([]);
            prismaService.client.orderFood.groupBy.mockResolvedValueOnce([
                { foodId: 1, _sum: { quantity: 2 } },
                { foodId: 2, _sum: { quantity: 5 } },
            ]);
            prismaService.client.restaurantRating.groupBy.mockResolvedValueOnce([]);
            prismaService.client.food.findMany.mockResolvedValueOnce([
                {
                    id: 1,
                    name: 'Expensive Pizza',
                    price: 100,
                    image: 'expensive.jpg',
                    restaurantId: 101,
                    rating: 4,
                    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
                    restaurant: {
                        name: 'Pizza Town',
                        address: { latitude: null, longitude: null },
                    },
                    ratings: [],
                },
                {
                    id: 2,
                    name: 'Cheap Pizza',
                    price: 50,
                    image: 'cheap.jpg',
                    restaurantId: 101,
                    rating: 3,
                    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
                    restaurant: {
                        name: 'Pizza Town',
                        address: { latitude: null, longitude: null },
                    },
                    ratings: [{ vote: 5 }, { vote: 3 }],
                },
            ]);
            prismaService.client.restaurant.findMany.mockResolvedValueOnce([
                {
                    id: 101,
                    name: 'Pizza Town',
                    image: 'pizza-town.jpg',
                    deliveryFee: '1.25',
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                    address: { latitude: null, longitude: null },
                    foods: [{ category: { name: 'Pizza' } }],
                },
            ]);

            const result = await service.search({
                q: 'pizza',
                limit: 1,
                offset: 0,
                sort: 'price_low_to_high',
                categoryId: 7,
            });

            expect(prismaService.client.food.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        deleteAt: null,
                        isAvailable: true,
                        categoryId: 7,
                    }),
                }),
            );
            expect(prismaService.client.restaurant.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        foods: {
                            some: {
                                categoryId: 7,
                                deleteAt: null,
                                isAvailable: true,
                            },
                        },
                    }),
                }),
            );
            expect(result.foods).toEqual([
                {
                    id: 2,
                    name: 'Cheap Pizza',
                    price: 50,
                    imageUrl: 'cheap.jpg',
                    restaurantId: 101,
                    restaurantName: 'Pizza Town',
                    rating: 4,
                    soldCount: 5,
                    promoTag: null,
                },
            ]);
            expect(result.foods[0]).not.toHaveProperty('distance');
            expect(result.foods[0]).not.toHaveProperty('updatedAt');
            expect(result.restaurants[0]).toEqual(
                expect.objectContaining({
                    id: 101,
                    deliveryFee: 1.25,
                    distance: 0,
                }),
            );
        });
    });

    describe('getSuggestions', () => {
        it('should return suggested foods (top sellers) and nearby restaurants', async () => {
            const mockNow = new Date();

            // Mock top sold foods groupBy
            prismaService.client.orderFood.groupBy.mockResolvedValueOnce([
                { foodId: 1, _sum: { quantity: 15 } },
            ]);
            prismaService.client.orderFood.groupBy.mockResolvedValueOnce([
                { foodId: 1, _sum: { quantity: 15 } },
            ]);

            // Mock food findMany
            prismaService.client.food.findMany.mockResolvedValueOnce([
                {
                    id: 1,
                    name: 'Burger Phô Mai',
                    price: 50.0,
                    image: 'burger.jpg',
                    restaurantId: 101,
                    rating: 4,
                    label: 'Hot',
                    updatedAt: mockNow,
                    restaurant: {
                        name: 'Burger Town',
                        address: { latitude: 10.7, longitude: 106.6 },
                    },
                    ratings: [],
                },
            ]);
            prismaService.client.food.findMany.mockResolvedValueOnce([]);

            // Mock active vouchers
            prismaService.client.voucher.findMany.mockResolvedValueOnce([
                { id: 1, restaurantId: 101, type: 'PERCENT', sale: 15, status: 'APPLYING', startAt: null, endAt: null },
            ]);

            // Mock avg ratings
            prismaService.client.restaurantRating.groupBy.mockResolvedValueOnce([
                { restaurantId: 101, _avg: { vote: 4.6 } },
            ]);

            // Mock restaurants findMany (approved: true)
            prismaService.client.restaurant.findMany.mockResolvedValueOnce([
                {
                    id: 101,
                    name: 'Burger Town',
                    image: 'burger-town.jpg',
                    deliveryFee: 1.5,
                    createdAt: mockNow,
                    address: { latitude: 10.705, longitude: 106.605 }, // ~0.8 km away
                    foods: [
                        { category: { name: 'Fast Food' } },
                    ],
                },
            ]);

            const query = {
                lat: 10.7,
                lng: 106.6,
                limit: 10,
            };

            const result = await service.getSuggestions(query);
            expect(result.foods.length).toBe(1);
            expect(result.foods[0].soldCount).toBe(15);
            expect(result.restaurants.length).toBe(1);
            expect(result.restaurants[0].distance).toBeLessThanOrEqual(1.0); // Within 10km
            expect(result.restaurants[0].hasVoucher).toBe(true);
        });

        it('should fill suggestion foods with rating fallback and sort restaurants by rating when location is missing', async () => {
            prismaService.client.voucher.findMany.mockResolvedValueOnce([
                { id: 1, restaurantId: 102, type: 'FIXED', sale: 5 },
            ]);
            prismaService.client.restaurantRating.groupBy.mockResolvedValueOnce([
                { restaurantId: 101, _avg: { vote: 4.6 } },
                { restaurantId: 102, _avg: { vote: 4.9 } },
            ]);
            prismaService.client.orderFood.groupBy
                .mockResolvedValueOnce([{ foodId: 1, _sum: { quantity: 4 } }])
                .mockResolvedValueOnce([
                    { foodId: 1, _sum: { quantity: 4 } },
                    { foodId: 2, _sum: { quantity: 0 } },
                ]);
            prismaService.client.food.findMany
                .mockResolvedValueOnce([
                    {
                        id: 1,
                        name: 'Top Burger',
                        price: '70',
                        image: 'top.jpg',
                        restaurantId: 101,
                        rating: 4,
                        restaurant: {
                            name: 'Burger Town',
                            address: { latitude: 10.7, longitude: 106.6 },
                        },
                        ratings: [],
                    },
                ])
                .mockResolvedValueOnce([
                    {
                        id: 2,
                        name: 'Extra Burger',
                        price: '60',
                        image: 'extra.jpg',
                        restaurantId: 102,
                        rating: 3,
                        restaurant: {
                            name: 'Voucher Burger',
                            address: { latitude: 10.8, longitude: 106.7 },
                        },
                        ratings: [{ vote: 5 }, { vote: 4 }],
                    },
                ]);
            prismaService.client.restaurant.findMany.mockResolvedValueOnce([
                {
                    id: 101,
                    name: 'Burger Town',
                    image: 'burger.jpg',
                    deliveryFee: '2',
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                    address: { latitude: 10.7, longitude: 106.6 },
                    foods: [{ category: { name: 'Burger' } }],
                },
                {
                    id: 102,
                    name: 'Voucher Burger',
                    image: 'voucher.jpg',
                    deliveryFee: '1.5',
                    createdAt: new Date('2026-01-02T00:00:00.000Z'),
                    address: { latitude: 10.8, longitude: 106.7 },
                    foods: [{ category: { name: 'Fast Food' } }],
                },
            ]);

            const result = await service.getSuggestions({ limit: 2 });

            expect(prismaService.client.food.findMany).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    where: expect.objectContaining({
                        id: { notIn: [1] },
                    }),
                    take: 1,
                    orderBy: {
                        rating: 'desc',
                    },
                }),
            );
            expect(result.foods).toEqual([
                expect.objectContaining({
                    id: 1,
                    price: 70,
                    rating: 4,
                    soldCount: 4,
                }),
                expect.objectContaining({
                    id: 2,
                    price: 60,
                    rating: 4.5,
                    soldCount: 0,
                }),
            ]);
            expect(result.restaurants.map((restaurant) => restaurant.id)).toEqual([
                102,
                101,
            ]);
            expect(result.restaurants[0]).toEqual(
                expect.objectContaining({
                    averageRating: 4.9,
                    hasVoucher: true,
                    distance: 0,
                }),
            );
        });
    });

    describe('history management', () => {
        it('should get search history list', async () => {
            const historyRows = [{ id: 1, keyword: 'pizza', createdAt: new Date() }];
            prismaService.client.searchHistory.findMany.mockResolvedValueOnce(
                historyRows,
            );

            const history = await service.getHistory(1);

            expect(prismaService.client.searchHistory.findMany).toHaveBeenCalledWith({
                where: {
                    userId: 1,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            });
            expect(history).toBe(historyRows);
        });

        it('should save/upsert keyword to history', async () => {
            const mockDate = new Date();
            prismaService.client.searchHistory.upsert.mockResolvedValueOnce({
                id: 1,
                keyword: 'pizza',
                createdAt: mockDate,
            });
            const result = await service.saveHistory(1, { keyword: 'pizza' });
            expect(prismaService.client.searchHistory.upsert).toHaveBeenCalledWith({
                where: {
                    userId_keyword: {
                        userId: 1,
                        keyword: 'pizza',
                    },
                },
                update: {
                    createdAt: expect.any(Date),
                },
                create: {
                    userId: 1,
                    keyword: 'pizza',
                },
            });
            expect(result.keyword).toBe('pizza');
        });

        it('should clear all history', async () => {
            const result = await service.clearHistory(1);

            expect(prismaService.client.searchHistory.deleteMany).toHaveBeenCalledWith({
                userId: 1,
            });
            expect(result.success).toBe(true);
        });

        it('should delete a single history item', async () => {
            prismaService.client.searchHistory.findFirst.mockResolvedValueOnce({
                id: 99,
                userId: 1,
                keyword: 'pizza',
            });
            const result = await service.deleteHistoryItem(1, 99);

            expect(prismaService.client.searchHistory.findFirst).toHaveBeenCalledWith({
                where: {
                    id: 99,
                },
            });
            expect(prismaService.client.searchHistory.delete).toHaveBeenCalledWith({
                id: 99,
            });
            expect(result.success).toBe(true);
        });

        it('should throw NotFoundException if history item does not exist', async () => {
            prismaService.client.searchHistory.findFirst.mockResolvedValueOnce(null);
            await expect(service.deleteHistoryItem(1, 99)).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw ForbiddenException if user tries to delete another user\'s history item', async () => {
            prismaService.client.searchHistory.findFirst.mockResolvedValueOnce({
                id: 99,
                userId: 2,
                keyword: 'pizza',
            });
            await expect(service.deleteHistoryItem(1, 99)).rejects.toThrow(
                ForbiddenException,
            );
            expect(prismaService.client.searchHistory.delete).not.toHaveBeenCalled();
        });
    });

    describe('trending keywords', () => {
        it('should query and return trending keywords grouped by keyword in the last 7 days', async () => {
            const mockTrending = [
                { keyword: 'trà sữa', _count: { keyword: 150 } },
                { keyword: 'pizza', _count: { keyword: 98 } },
            ];
            prismaService.client.searchHistory.groupBy.mockResolvedValueOnce(mockTrending);

            const result = await service.getTrending({ limit: 5 });

            expect(prismaService.client.searchHistory.groupBy).toHaveBeenCalledWith({
                by: ['keyword'],
                _count: {
                    keyword: true,
                },
                where: {
                    createdAt: {
                        gte: expect.any(Date),
                    },
                },
                orderBy: {
                    _count: {
                        keyword: 'desc',
                    },
                },
                take: 5,
            });

            expect(result).toEqual([
                { keyword: 'trà sữa', searchCount: 150 },
                { keyword: 'pizza', searchCount: 98 },
            ]);
        });
    });
});
