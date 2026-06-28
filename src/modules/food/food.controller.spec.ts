jest.mock('@prisma/client', () => ({
    Role: {
        ADMIN: 'ADMIN',
        BUSINESS: 'BUSINESS',
        CUSTOMER: 'CUSTOMER',
    },
    OrderStatus: {
        DELIVERED: 'DELIVERED',
    },
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

import { FoodController } from './food.controller';

describe('FoodController', () => {
    let controller: FoodController;
    let foodService: {
        getAllFood: jest.Mock;
        getAllIngredients: jest.Mock;
        getFoodDetail: jest.Mock;
        createFoodRating: jest.Mock;
        getFoodRatings: jest.Mock;
        createFood: jest.Mock;
        updateFood: jest.Mock;
        deleteFood: jest.Mock;
    };

    beforeEach(() => {
        foodService = {
            getAllFood: jest.fn(),
            getAllIngredients: jest.fn(),
            getFoodDetail: jest.fn(),
            createFoodRating: jest.fn(),
            getFoodRatings: jest.fn(),
            createFood: jest.fn(),
            updateFood: jest.fn(),
            deleteFood: jest.fn(),
        };

        controller = new FoodController(foodService as any);
    });

    it('should forward get all food query to service', async () => {
        const query = { name: 'bur', limit: 5 };
        foodService.getAllFood.mockResolvedValueOnce([{ id: 1 }]);

        const result = await controller.getAllFood(query);

        expect(foodService.getAllFood).toHaveBeenCalledWith(query);
        expect(result).toEqual([{ id: 1 }]);
    });

    it('should forward ingredients request to service', async () => {
        foodService.getAllIngredients.mockResolvedValueOnce([{ id: 1 }]);

        const result = await controller.getAllIngredients();

        expect(foodService.getAllIngredients).toHaveBeenCalledWith();
        expect(result).toEqual([{ id: 1 }]);
    });

    it('should forward food detail id to service', async () => {
        foodService.getFoodDetail.mockResolvedValueOnce({ id: 1 });

        const result = await controller.getFoodDetail(1);

        expect(foodService.getFoodDetail).toHaveBeenCalledWith(1);
        expect(result).toEqual({ id: 1 });
    });

    it('should forward rating request with authenticated user id', async () => {
        const body = { orderId: 7, vote: 5 };
        foodService.createFoodRating.mockResolvedValueOnce({
            message: 'Food rated successfully',
        });

        const result = await controller.createFoodRating(
            { user: { id: 99 } } as any,
            100,
            body,
        );

        expect(foodService.createFoodRating).toHaveBeenCalledWith(100, 99, body);
        expect(result).toEqual({ message: 'Food rated successfully' });
    });

    it('should forward food ratings request to service', async () => {
        foodService.getFoodRatings.mockResolvedValueOnce([{ id: 1 }]);

        const result = await controller.getFoodRatings(100);

        expect(foodService.getFoodRatings).toHaveBeenCalledWith(100);
        expect(result).toEqual([{ id: 1 }]);
    });

    it('should forward create food with actor id, roles, body and file', async () => {
        const body = { name: 'Burger', categoryId: 2, restaurantId: 3 };
        const file = { originalname: 'burger.jpg' } as any;
        foodService.createFood.mockResolvedValueOnce({ id: 100 });

        const result = await controller.createFood(
            { user: { id: 99, roles: ['ADMIN'] } } as any,
            body,
            file,
        );

        expect(foodService.createFood).toHaveBeenCalledWith(
            99,
            ['ADMIN'],
            body,
            file,
        );
        expect(result).toEqual({ id: 100 });
    });

    it('should forward update food with actor id, roles, id, body and file', async () => {
        const body = { name: 'Updated Burger' };
        const file = { originalname: 'burger.jpg' } as any;
        foodService.updateFood.mockResolvedValueOnce({ id: 100 });

        const result = await controller.updateFood(
            { user: { id: 99, roles: ['BUSINESS'] } } as any,
            100,
            body,
            file,
        );

        expect(foodService.updateFood).toHaveBeenCalledWith(
            99,
            ['BUSINESS'],
            100,
            body,
            file,
        );
        expect(result).toEqual({ id: 100 });
    });

    it('should default missing roles to an empty array when deleting food', async () => {
        foodService.deleteFood.mockResolvedValueOnce({
            message: 'Food deleted successfully',
        });

        const result = await controller.deleteFood(
            { user: { id: 99 } } as any,
            100,
        );

        expect(foodService.deleteFood).toHaveBeenCalledWith(99, [], 100);
        expect(result).toEqual({ message: 'Food deleted successfully' });
    });
});
