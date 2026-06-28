jest.mock('@prisma/client', () => ({
    Role: {
        CUSTOMER: 'CUSTOMER',
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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CartService } from './cart.service';

describe('CartService', () => {
    let service: CartService;
    let prismaService: any;

    const money = (value: number) => ({
        mul: jest.fn((quantity: number) => value * quantity),
        valueOf: () => value,
    });

    const emptyCartResult = {
        id: 1,
        totalItems: 0,
        subtotal: 0,
        restaurant: null,
        items: [],
    };

    beforeEach(() => {
        prismaService = {
            client: {
                cart: {
                    findFirst: jest.fn(),
                },
                cartItem: {
                    findMany: jest.fn(),
                    findFirst: jest.fn(),
                    update: jest.fn(),
                    create: jest.fn(),
                    delete: jest.fn(),
                    deleteMany: jest.fn(),
                },
                food: {
                    findFirst: jest.fn(),
                    findUnique: jest.fn(),
                },
            },
        };

        service = new CartService(prismaService);
    });

    it('should throw NotFoundException when user cart does not exist', async () => {
        prismaService.client.cart.findFirst.mockResolvedValueOnce(null);

        await expect(service.getCart(99)).rejects.toThrow(NotFoundException);
    });

    it('should return normalized cart items, totals, subtotal and restaurant', async () => {
        const foodPrice = money(10);
        const sizePrice = money(12.5);
        prismaService.client.cart.findFirst.mockResolvedValueOnce({
            id: 1,
            userId: 99,
        });
        prismaService.client.cartItem.findMany.mockResolvedValueOnce([
            {
                id: 7,
                quantity: 2,
                foodSizeId: 3,
                foodSize: {
                    price: sizePrice,
                    size: {
                        name: 'Large',
                    },
                },
                food: {
                    id: 5,
                    name: 'Pizza',
                    price: foodPrice,
                    image: 'pizza.jpg',
                    label: 'Best seller',
                    restaurantId: 8,
                    restaurant: {
                        id: 8,
                        name: 'Pizza Shop',
                    },
                    category: {
                        id: 2,
                        name: 'Fast Food',
                    },
                },
            },
        ]);

        const result = await service.getCart(99);

        expect(prismaService.client.cart.findFirst).toHaveBeenCalledWith({
            where: {
                userId: 99,
            },
            select: {
                id: true,
                userId: true,
            },
        });
        expect(prismaService.client.cartItem.findMany).toHaveBeenCalledWith({
            where: {
                cartId: 1,
            },
            select: {
                id: true,
                quantity: true,
                foodSizeId: true,
                foodSize: {
                    include: {
                        size: true,
                    },
                },
                food: {
                    select: {
                        id: true,
                        name: true,
                        price: true,
                        image: true,
                        label: true,
                        restaurantId: true,
                        restaurant: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                        category: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                id: 'asc',
            },
        });
        expect(sizePrice.mul).toHaveBeenCalledWith(2);
        expect(result).toEqual({
            id: 1,
            totalItems: 2,
            subtotal: 25,
            restaurant: {
                id: 8,
                name: 'Pizza Shop',
            },
            items: [
                {
                    id: 7,
                    quantity: 2,
                    lineTotal: 25,
                    foodSizeId: 3,
                    sizeName: 'Large',
                    food: {
                        id: 5,
                        name: 'Pizza',
                        price: 12.5,
                        image: 'pizza.jpg',
                        label: 'Best seller',
                        restaurantId: 8,
                        restaurant: {
                            id: 8,
                            name: 'Pizza Shop',
                        },
                        category: {
                            id: 2,
                            name: 'Fast Food',
                        },
                    },
                },
            ],
        });
    });

    it('should reject adding food from another restaurant', async () => {
        prismaService.client.cart.findFirst
            .mockResolvedValueOnce({ id: 1, userId: 99 })
            .mockResolvedValueOnce({ id: 1, userId: 99 });
        prismaService.client.food.findFirst.mockResolvedValueOnce({
            id: 5,
            restaurantId: 9,
            restaurant: { id: 9, name: 'Other Shop' },
        });
        prismaService.client.cartItem.findMany.mockResolvedValueOnce([
            {
                id: 7,
                quantity: 1,
                foodSizeId: null,
                foodSize: null,
                food: {
                    id: 3,
                    name: 'Burger',
                    price: money(10),
                    restaurantId: 8,
                    restaurant: {
                        id: 8,
                        name: 'Burger Shop',
                    },
                    category: null,
                },
            },
        ]);

        await expect(
            service.pushCartItem(99, { foodId: 5, quantity: 1 }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should create a cart item using the default food size', async () => {
        prismaService.client.cart.findFirst
            .mockResolvedValueOnce({ id: 1, userId: 99 })
            .mockResolvedValueOnce({ id: 1, userId: 99 })
            .mockResolvedValueOnce({ id: 1, userId: 99 });
        prismaService.client.food.findFirst.mockResolvedValueOnce({
            id: 5,
            name: 'Pizza',
            price: money(10),
            image: 'pizza.jpg',
            restaurantId: 8,
            restaurant: { id: 8, name: 'Pizza Shop' },
            category: { id: 2, name: 'Fast Food' },
        });
        prismaService.client.cartItem.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        prismaService.client.food.findUnique.mockResolvedValueOnce({
            id: 5,
            sizes: [
                {
                    id: 11,
                    isDefault: true,
                    deleteAt: null,
                    size: { id: 1, name: 'Regular' },
                },
            ],
        });
        prismaService.client.cartItem.findFirst.mockResolvedValueOnce(null);
        prismaService.client.cartItem.create.mockResolvedValueOnce({ id: 20 });

        const result = await service.pushCartItem(99, {
            foodId: 5,
            quantity: 2,
        });

        expect(prismaService.client.food.findUnique).toHaveBeenCalledWith({
            where: { id: 5 },
            include: {
                sizes: {
                    where: { deleteAt: null },
                    include: { size: true },
                },
            },
        });
        expect(prismaService.client.cartItem.create).toHaveBeenCalledWith({
            data: {
                cartId: 1,
                quantity: 2,
                foodId: 5,
                foodSizeId: 11,
            },
        });
        expect(result).toEqual(emptyCartResult);
    });

    it('should increment quantity when the same cart item already exists', async () => {
        prismaService.client.cart.findFirst
            .mockResolvedValueOnce({ id: 1, userId: 99 })
            .mockResolvedValueOnce({ id: 1, userId: 99 })
            .mockResolvedValueOnce({ id: 1, userId: 99 });
        prismaService.client.food.findFirst.mockResolvedValueOnce({
            id: 5,
            name: 'Pizza',
            price: money(10),
            restaurantId: 8,
            restaurant: { id: 8, name: 'Pizza Shop' },
            category: null,
        });
        prismaService.client.cartItem.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);
        prismaService.client.food.findUnique.mockResolvedValueOnce({
            id: 5,
            sizes: [
                {
                    id: 12,
                    isDefault: false,
                    deleteAt: null,
                    size: { id: 2, name: 'Large' },
                },
            ],
        });
        prismaService.client.cartItem.findFirst.mockResolvedValueOnce({
            id: 20,
            cartId: 1,
            foodId: 5,
            foodSizeId: 12,
        });
        prismaService.client.cartItem.update.mockResolvedValueOnce({ id: 20 });

        const result = await service.pushCartItem(99, {
            foodId: 5,
            quantity: 3,
            foodSizeId: 12,
        });

        expect(prismaService.client.cartItem.update).toHaveBeenCalledWith({
            where: {
                id: 20,
            },
            data: {
                quantity: {
                    increment: 3,
                },
            },
        });
        expect(prismaService.client.cartItem.create).not.toHaveBeenCalled();
        expect(result).toEqual(emptyCartResult);
    });

    it('should reject a selected size that does not belong to the food', async () => {
        prismaService.client.cart.findFirst
            .mockResolvedValueOnce({ id: 1, userId: 99 })
            .mockResolvedValueOnce({ id: 1, userId: 99 });
        prismaService.client.food.findFirst.mockResolvedValueOnce({
            id: 5,
            restaurantId: 8,
            restaurant: { id: 8, name: 'Pizza Shop' },
        });
        prismaService.client.cartItem.findMany.mockResolvedValueOnce([]);
        prismaService.client.food.findUnique.mockResolvedValueOnce({
            id: 5,
            sizes: [{ id: 11, isDefault: true }],
        });

        await expect(
            service.pushCartItem(99, {
                foodId: 5,
                quantity: 1,
                foodSizeId: 999,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when updating a missing cart item', async () => {
        prismaService.client.cart.findFirst.mockResolvedValueOnce({
            id: 1,
            userId: 99,
        });
        prismaService.client.cartItem.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.updateCartItem(99, 404, { quantity: 2 }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should delete a cart item when updated quantity is zero', async () => {
        prismaService.client.cart.findFirst
            .mockResolvedValueOnce({ id: 1, userId: 99 })
            .mockResolvedValueOnce({ id: 1, userId: 99 });
        prismaService.client.cartItem.findFirst.mockResolvedValueOnce({
            id: 20,
            cartId: 1,
        });
        prismaService.client.cartItem.delete.mockResolvedValueOnce({ id: 20 });
        prismaService.client.cartItem.findMany.mockResolvedValueOnce([]);

        const result = await service.updateCartItem(99, 20, { quantity: 0 });

        expect(prismaService.client.cartItem.delete).toHaveBeenCalledWith({
            id: 20,
        });
        expect(prismaService.client.cartItem.update).not.toHaveBeenCalled();
        expect(result).toEqual(emptyCartResult);
    });

    it('should update cart item quantity', async () => {
        prismaService.client.cart.findFirst
            .mockResolvedValueOnce({ id: 1, userId: 99 })
            .mockResolvedValueOnce({ id: 1, userId: 99 });
        prismaService.client.cartItem.findFirst.mockResolvedValueOnce({
            id: 20,
            cartId: 1,
        });
        prismaService.client.cartItem.update.mockResolvedValueOnce({ id: 20 });
        prismaService.client.cartItem.findMany.mockResolvedValueOnce([]);

        const result = await service.updateCartItem(99, 20, { quantity: 4 });

        expect(prismaService.client.cartItem.update).toHaveBeenCalledWith({
            where: {
                id: 20,
            },
            data: {
                quantity: 4,
            },
        });
        expect(result).toEqual(emptyCartResult);
    });

    it('should delete a cart item by id', async () => {
        prismaService.client.cart.findFirst
            .mockResolvedValueOnce({ id: 1, userId: 99 })
            .mockResolvedValueOnce({ id: 1, userId: 99 });
        prismaService.client.cartItem.findFirst.mockResolvedValueOnce({
            id: 20,
            cartId: 1,
        });
        prismaService.client.cartItem.delete.mockResolvedValueOnce({ id: 20 });
        prismaService.client.cartItem.findMany.mockResolvedValueOnce([]);

        const result = await service.deleteCartById(99, 20);

        expect(prismaService.client.cartItem.delete).toHaveBeenCalledWith({
            id: 20,
        });
        expect(result).toEqual(emptyCartResult);
    });

    it('should clear all cart items', async () => {
        prismaService.client.cart.findFirst.mockResolvedValueOnce({
            id: 1,
            userId: 99,
        });
        prismaService.client.cartItem.deleteMany.mockResolvedValueOnce({
            count: 3,
        });

        const result = await service.clearCart(99);

        expect(prismaService.client.cartItem.deleteMany).toHaveBeenCalledWith({
            cartId: 1,
        });
        expect(result).toEqual({
            message: 'Cart cleared successfully',
        });
    });
});
