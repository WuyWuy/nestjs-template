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

import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { FoodService } from './food.service';

describe('FoodService', () => {
    let service: FoodService;
    let prismaService: any;
    let auditService: { log: jest.Mock };
    let minioService: { uploadFile: jest.Mock };

    const tx = {
        food: {
            create: jest.fn(),
            update: jest.fn(),
        },
        foodSize: {
            createMany: jest.fn(),
            deleteMany: jest.fn(),
        },
        foodIngredient: {
            createMany: jest.fn(),
            deleteMany: jest.fn(),
            upsert: jest.fn(),
        },
        foodRating: {
            findFirst: jest.fn(),
            create: jest.fn(),
            aggregate: jest.fn(),
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        prismaService = {
            client: {
                food: {
                    findMany: jest.fn(),
                    findFirst: jest.fn(),
                    findUnique: jest.fn(),
                    delete: jest.fn(),
                },
                restaurant: {
                    findFirst: jest.fn(),
                },
                size: {
                    findMany: jest.fn(),
                },
                ingredient: {
                    findMany: jest.fn(),
                    count: jest.fn(),
                },
                order: {
                    findFirst: jest.fn(),
                },
                foodRating: {
                    findMany: jest.fn(),
                },
                $transaction: jest.fn((callback) => callback(tx)),
            },
        };
        auditService = {
            log: jest.fn(),
        };
        minioService = {
            uploadFile: jest.fn(),
        };

        service = new FoodService(
            prismaService,
            auditService as any,
            minioService as any,
        );
    });

    it('should list available foods with filters, sorting and normalized sizes', async () => {
        prismaService.client.food.findMany.mockResolvedValueOnce([
            {
                id: 1,
                name: 'Burger',
                price: '9.5',
                sizes: [
                    {
                        id: 10,
                        sizeId: 2,
                        price: '12.5',
                        isDefault: true,
                        size: { name: 'Large' },
                    },
                ],
            },
        ]);

        const result = await service.getAllFood({
            name: 'bur',
            categoryId: 2,
            restaurantId: 3,
            minPrice: 5,
            maxPrice: 20,
            minRating: 4,
            sortBy: 'PRICE_ASC',
            limit: 5,
            offset: 10,
        });

        expect(prismaService.client.food.findMany).toHaveBeenCalledWith({
            take: 5,
            skip: 10,
            where: {
                isAvailable: true,
                name: {
                    contains: 'bur',
                    mode: 'insensitive',
                },
                categoryId: 2,
                restaurantId: 3,
                price: {
                    gte: 5,
                    lte: 20,
                },
                rating: {
                    gte: 4,
                },
            },
            include: expect.any(Object),
            orderBy: { price: 'asc' },
        });
        expect(result).toEqual([
            {
                id: 1,
                name: 'Burger',
                price: 9.5,
                sizes: [
                    {
                        foodSizeId: 10,
                        sizeId: 2,
                        name: 'Large',
                        price: 12.5,
                        isDefault: true,
                    },
                ],
            },
        ]);
    });

    it('should throw NotFoundException when food detail does not exist', async () => {
        prismaService.client.food.findFirst.mockResolvedValueOnce(null);

        await expect(service.getFoodDetail(404)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should return food detail with normalized price, ingredients and sizes', async () => {
        prismaService.client.food.findFirst.mockResolvedValueOnce({
            id: 1,
            name: 'Burger',
            price: '9.5',
            foodIngredients: [
                {
                    ingredient: {
                        id: 7,
                        name: 'Cheese',
                        icon: 'cheese.png',
                    },
                },
            ],
            sizes: [
                {
                    id: 10,
                    sizeId: 2,
                    price: '12.5',
                    isDefault: true,
                    size: { name: 'Large' },
                },
            ],
        });

        const result = await service.getFoodDetail(1);

        expect(result).toEqual({
            id: 1,
            name: 'Burger',
            price: 9.5,
            foodIngredients: [
                {
                    id: 7,
                    name: 'Cheese',
                    icon: 'cheese.png',
                },
            ],
            sizes: [
                {
                    foodSizeId: 10,
                    sizeId: 2,
                    name: 'Large',
                    price: 12.5,
                    isDefault: true,
                },
            ],
        });
    });

    it('should reject business food creation when actor does not own restaurant', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            ownerId: 44,
        });

        await expect(
            service.createFood(99, ['BUSINESS'], {
                name: 'Burger',
                categoryId: 2,
                restaurantId: 3,
                sizes: [{ sizeId: 1, price: 9, isDefault: true }],
            }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should reject creating food without sizes', async () => {
        await expect(
            service.createFood(99, ['ADMIN'], {
                name: 'Burger',
                categoryId: 2,
                restaurantId: 3,
            }),
        ).rejects.toThrow('Sizes are required for creating a food');
    });

    it('should reject duplicate default sizes', async () => {
        await expect(
            service.createFood(99, ['ADMIN'], {
                name: 'Burger',
                categoryId: 2,
                restaurantId: 3,
                sizes: [
                    { sizeId: 1, price: 9, isDefault: true },
                    { sizeId: 2, price: 12, isDefault: true },
                ],
            }),
        ).rejects.toThrow('Exactly one size must be set as default');
    });

    it('should create food with uploaded image, sizes, ingredients and audit log', async () => {
        const file = { originalname: 'burger.jpg' } as any;
        const data = {
            name: 'Burger',
            description: 'Tasty',
            categoryId: 2,
            restaurantId: 3,
            label: 'Best seller',
            isAvailable: true,
            sizes: [
                { sizeId: 1, price: 9, isDefault: true },
                { sizeId: 2, price: 12, isDefault: false },
            ],
            ingredientIds: [7, 8],
        };
        prismaService.client.size.findMany.mockResolvedValueOnce([
            { id: 1 },
            { id: 2 },
        ]);
        prismaService.client.ingredient.count.mockResolvedValueOnce(2);
        minioService.uploadFile.mockResolvedValueOnce('food.jpg');
        tx.food.create.mockResolvedValueOnce({ id: 100, name: 'Burger' });

        const result = await service.createFood(99, ['ADMIN'], data, file);

        expect(minioService.uploadFile).toHaveBeenCalledWith(file);
        expect(tx.food.create).toHaveBeenCalledWith({
            data: {
                name: 'Burger',
                description: 'Tasty',
                categoryId: 2,
                price: 9,
                image: 'food.jpg',
                label: 'Best seller',
                restaurantId: 3,
                isAvailable: true,
            },
        });
        expect(tx.foodSize.createMany).toHaveBeenCalledWith({
            data: [
                { foodId: 100, sizeId: 1, price: 9, isDefault: true },
                { foodId: 100, sizeId: 2, price: 12, isDefault: false },
            ],
        });
        expect(tx.foodIngredient.createMany).toHaveBeenCalledWith({
            data: [
                { foodId: 100, ingredientId: 7 },
                { foodId: 100, ingredientId: 8 },
            ],
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'CREATE_FOOD',
            'Food',
            100,
            99,
            data,
        );
        expect(result).toEqual({ id: 100, name: 'Burger' });
    });

    it('should throw NotFoundException when updating a missing food', async () => {
        prismaService.client.food.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.updateFood(99, ['ADMIN'], 404, { name: 'Burger' }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should update food sizes and ingredients in a transaction', async () => {
        const data = {
            name: 'Updated Burger',
            sizes: [{ sizeId: 1, price: 11, isDefault: true }],
            ingredientIds: [7],
        };
        prismaService.client.food.findFirst.mockResolvedValueOnce({
            id: 100,
            restaurantId: 3,
        });
        prismaService.client.size.findMany.mockResolvedValueOnce([{ id: 1 }]);
        prismaService.client.ingredient.count.mockResolvedValueOnce(1);
        tx.food.update.mockResolvedValueOnce({ id: 100, name: 'Updated Burger' });

        const result = await service.updateFood(99, ['ADMIN'], 100, data);

        expect(tx.food.update).toHaveBeenCalledWith({
            where: { id: 100 },
            data: {
                name: 'Updated Burger',
                price: 11,
            },
        });
        expect(tx.foodSize.deleteMany).toHaveBeenCalledWith({ foodId: 100 });
        expect(tx.foodSize.createMany).toHaveBeenCalledWith({
            data: [{ foodId: 100, sizeId: 1, price: 11, isDefault: true }],
        });
        expect(tx.foodIngredient.deleteMany).toHaveBeenCalledWith({ foodId: 100 });
        expect(tx.foodIngredient.upsert).toHaveBeenCalledWith({
            where: {
                foodId_ingredientId: {
                    foodId: 100,
                    ingredientId: 7,
                },
            },
            create: {
                foodId: 100,
                ingredientId: 7,
            },
            update: {
                deleteAt: null,
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'UPDATE_FOOD',
            'Food',
            100,
            99,
            data,
        );
        expect(result).toEqual({ id: 100, name: 'Updated Burger' });
    });

    it('should delete food and write audit log', async () => {
        prismaService.client.food.findFirst.mockResolvedValueOnce({
            id: 100,
            restaurantId: 3,
        });
        prismaService.client.food.delete.mockResolvedValueOnce({ id: 100 });

        const result = await service.deleteFood(99, ['ADMIN'], 100);

        expect(prismaService.client.food.delete).toHaveBeenCalledWith({ id: 100 });
        expect(auditService.log).toHaveBeenCalledWith(
            'DELETE_FOOD',
            'Food',
            100,
            99,
        );
        expect(result).toEqual({ message: 'Food deleted successfully' });
    });

    it('should return all ingredients ordered by id', async () => {
        prismaService.client.ingredient.findMany.mockResolvedValueOnce([
            { id: 1, name: 'Cheese' },
        ]);

        const result = await service.getAllIngredients();

        expect(prismaService.client.ingredient.findMany).toHaveBeenCalledWith({
            orderBy: { id: 'asc' },
        });
        expect(result).toEqual([{ id: 1, name: 'Cheese' }]);
    });

    it('should reject rating when food does not exist', async () => {
        prismaService.client.food.findUnique.mockResolvedValueOnce(null);

        await expect(
            service.createFoodRating(100, 99, { orderId: 7, vote: 5 }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should reject rating when delivered order does not match', async () => {
        prismaService.client.food.findUnique.mockResolvedValueOnce({ id: 100 });
        prismaService.client.order.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.createFoodRating(100, 99, { orderId: 7, vote: 5 }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should create rating, update average and audit', async () => {
        prismaService.client.food.findUnique.mockResolvedValueOnce({ id: 100 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 7,
            orderFoods: [{ foodId: 100 }],
        });
        tx.foodRating.findFirst.mockResolvedValueOnce(null);
        tx.foodRating.aggregate.mockResolvedValueOnce({ _avg: { vote: 4.6 } });

        const result = await service.createFoodRating(100, 99, {
            orderId: 7,
            vote: 5,
            comment: 'Great',
        });

        expect(tx.foodRating.create).toHaveBeenCalledWith({
            data: {
                foodId: 100,
                userId: 99,
                orderId: 7,
                vote: 5,
                comment: 'Great',
            },
        });
        expect(tx.food.update).toHaveBeenCalledWith({
            where: { id: 100 },
            data: { rating: 5 },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'CREATE_FOOD_RATING',
            'FoodRating',
            100,
            99,
            { vote: 5 },
        );
        expect(result).toEqual({ message: 'Food rated successfully' });
    });

    it('should get food ratings after validating food exists', async () => {
        const ratings = [{ id: 1, vote: 5 }];
        prismaService.client.food.findUnique.mockResolvedValueOnce({ id: 100 });
        prismaService.client.foodRating.findMany.mockResolvedValueOnce(ratings);

        const result = await service.getFoodRatings(100);

        expect(prismaService.client.foodRating.findMany).toHaveBeenCalledWith({
            where: {
                foodId: 100,
                deleteAt: null,
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
            orderBy: {
                createdAt: 'desc',
            },
        });
        expect(result).toEqual(ratings);
    });
});
