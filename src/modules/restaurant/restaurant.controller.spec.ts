import { Test, TestingModule } from '@nestjs/testing';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';

describe('RestaurantController', () => {
    let controller: RestaurantController;
    let service: RestaurantService;

    const mockRestaurantService = {
        getAllRestaurants: jest.fn(),
        getRestaurantMenu: jest.fn(),
        getRestaurantInDetail: jest.fn(),
        getRestaurantStats: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [RestaurantController],
            providers: [
                {
                    provide: RestaurantService,
                    useValue: mockRestaurantService,
                },
            ],
        }).compile();

        controller = module.get<RestaurantController>(RestaurantController);
        service = module.get<RestaurantService>(RestaurantService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('getRestaurantStats', () => {
        it('should call service.getRestaurantStats with restaurantId', async () => {
            const mockStats = {
                totalOrders: 10,
                totalRevenue: 1000,
                averageRating: 4.2,
                totalRatings: 5,
                totalFoods: 7,
            };

            mockRestaurantService.getRestaurantStats.mockResolvedValue(mockStats);

            const result = await controller.getRestaurantStats(1);

            expect(result).toEqual(mockStats);
            expect(mockRestaurantService.getRestaurantStats).toHaveBeenCalledWith(1);
        });
    });
});