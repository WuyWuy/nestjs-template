import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantService } from './restaurant.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('RestaurantService', () => {
    let service: RestaurantService;
    let prismaService: PrismaService;

    const mockPrismaClient = {
        restaurant: {
            findUnique: jest.fn(),
            findMany: jest.fn(),
            findFirst: jest.fn(),
        },
        order: {
            aggregate: jest.fn(),
        },
        restaurantRating: {
            aggregate: jest.fn(),
        },
        food: {
            count: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RestaurantService,
                {
                    provide: PrismaService,
                    useValue: {
                        client: mockPrismaClient,
                    },
                },
            ],
        }).compile();

        service = module.get<RestaurantService>(RestaurantService);
        prismaService = module.get<PrismaService>(PrismaService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getRestaurantStats', () => {
        it('should return restaurant stats', async () => {
            const mockRestaurant = { id: 1 };
            const mockOrderStats = {
                _count: { id: 10 },
                _sum: { totalPrice: { toNumber: () => 1000.5 } },
            };
            const mockRatingStats = {
                _count: { id: 5 },
                _avg: { vote: 4.2 },
            };
            const mockFoodCount = 20;

            mockPrismaClient.restaurant.findUnique.mockResolvedValue(mockRestaurant);
            mockPrismaClient.order.aggregate.mockResolvedValue(mockOrderStats);
            mockPrismaClient.restaurantRating.aggregate.mockResolvedValue(mockRatingStats);
            mockPrismaClient.food.count.mockResolvedValue(mockFoodCount);

            const result = await service.getRestaurantStats(1);

            expect(result).toEqual({
                totalOrders: 10,
                totalRevenue: 1000.5,
                averageRating: 4.2,
                totalRatings: 5,
                totalFoods: 20,
            });
        });

        it('should throw NotFoundException if restaurant not found', async () => {
            mockPrismaClient.restaurant.findUnique.mockResolvedValue(null);

            await expect(service.getRestaurantStats(1)).rejects.toThrow('Restaurant not found');
        });
    });
});