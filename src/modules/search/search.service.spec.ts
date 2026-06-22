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
    TokenType: {
        ACCESS: 'ACCESS',
        REFRESH: 'REFRESH',
    },
}));

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
    });

    describe('history management', () => {
        it('should get search history list', async () => {
            prismaService.client.searchHistory.findMany.mockResolvedValueOnce([
                { id: 1, keyword: 'pizza', createdAt: new Date() },
            ]);
            const history = await service.getHistory(1);
            expect(history).toBeDefined();
        });

        it('should save/upsert keyword to history', async () => {
            const mockDate = new Date();
            prismaService.client.searchHistory.upsert.mockResolvedValueOnce({
                id: 1,
                keyword: 'pizza',
                createdAt: mockDate,
            });
            const result = await service.saveHistory(1, { keyword: 'pizza' });
            expect(result.keyword).toBe('pizza');
        });

        it('should clear all history', async () => {
            const result = await service.clearHistory(1);
            expect(result.success).toBe(true);
        });

        it('should delete a single history item', async () => {
            prismaService.client.searchHistory.findFirst.mockResolvedValueOnce({
                id: 99,
                userId: 1,
                keyword: 'pizza',
            });
            const result = await service.deleteHistoryItem(1, 99);
            expect(result.success).toBe(true);
        });

        it('should throw NotFoundException if history item does not exist', async () => {
            prismaService.client.searchHistory.findFirst.mockResolvedValueOnce(null);
            await expect(service.deleteHistoryItem(1, 99)).rejects.toThrow(
                'History item not found',
            );
        });

        it('should throw ForbiddenException if user tries to delete another user\'s history item', async () => {
            prismaService.client.searchHistory.findFirst.mockResolvedValueOnce({
                id: 99,
                userId: 2,
                keyword: 'pizza',
            });
            await expect(service.deleteHistoryItem(1, 99)).rejects.toThrow(
                'You do not have permission to delete this history item',
            );
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
