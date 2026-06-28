import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CreateCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

@Injectable()
export class CartService {
    constructor(private readonly prismaService: PrismaService) {}

    private async getUserCartOrThrow(userId: number) {
        const cart = await this.prismaService.client.cart.findFirst({
            where: {
                userId,
            },
            select: {
                id: true,
                userId: true,
            },
        });

        if (!cart) {
            throw new NotFoundException('Cart not found');
        }

        return cart;
    }

    private async getFoodOrThrow(foodId: number) {
        const food = await this.prismaService.client.food.findFirst({
            where: {
                id: foodId,
            },
            select: {
                id: true,
                isAvailable: true,
            },
        });

        if (!food) {
            throw new NotFoundException('Food not found');
        }
        if (!food.isAvailable) {
            throw new BadRequestException('Food is not available');
        }

        return food;
    }

    async getCart(userId: number) {
        const cart = await this.getUserCartOrThrow(userId);

        const items = await this.prismaService.client.cartItem.findMany({
            where: {
                cartId: cart.id,
            },
            select: {
                id: true,
                quantity: true,
                fullText: true,
                foodSizeId: true,
                updatedAt: true,
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
                                image: true,
                                deliveryFee: true,
                                estimatedDeliveryTime: true,
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
                updatedAt: 'desc',
            },
        });

        const normalizedItems = items.map((item) => {
            const activePrice = item.foodSize ? item.foodSize.price : item.food.price;
            const lineTotal = activePrice.mul(item.quantity);
            const { restaurant, ...food } = item.food;

            return {
                id: item.id,
                quantity: item.quantity,
                lineTotal: Number(lineTotal),
                foodSizeId: item.foodSizeId,
                sizeName: item.foodSize?.size.name ?? null,
                fullText: item.fullText,
                updatedAt: item.updatedAt,
                groupRestaurant: {
                    ...restaurant,
                    deliveryFee: Number(restaurant.deliveryFee),
                },
                food: {
                    ...food,
                    price: Number(activePrice),
                    restaurant: {
                        id: restaurant.id,
                        name: restaurant.name,
                    },
                },
            };
        });

        const subtotal = normalizedItems.reduce(
            (sum, item) => sum + item.lineTotal,
            0,
        );

        const restaurantGroups = Array.from(
            normalizedItems
                .reduce((groups, item) => {
                    const restaurantId = item.food.restaurantId;
                    const current = groups.get(restaurantId);
                    if (current) {
                        current.itemCount += item.quantity;
                        current.subtotal += item.lineTotal;
                        current.items.push(item);
                    } else {
                        groups.set(restaurantId, {
                            restaurant: item.groupRestaurant,
                            itemCount: item.quantity,
                            subtotal: item.lineTotal,
                            items: [item],
                        });
                    }
                    return groups;
                }, new Map<number, {
                    restaurant: {
                        id: number;
                        name: string;
                        image: string;
                        deliveryFee: number;
                        estimatedDeliveryTime: number;
                    };
                    itemCount: number;
                    subtotal: number;
                    items: typeof normalizedItems;
                }>())
                .values(),
        ).map((group) => ({
            ...group,
            items: group.items.map(
                ({ updatedAt: _updatedAt, groupRestaurant: _group, ...item }) =>
                    item,
            ),
        }));
        const flatItems = normalizedItems.map(
            ({ updatedAt: _updatedAt, groupRestaurant: _group, ...item }) =>
                item,
        );

        return {
            id: cart.id,
            totalItems: normalizedItems.reduce(
                (sum, item) => sum + item.quantity,
                0,
            ),
            subtotal,
            restaurant: null,
            restaurantGroups,
            items: flatItems,
        };
    }

    async pushCartItem(userId: number, data: CreateCartItemDto) {
        const cart = await this.getUserCartOrThrow(userId);
        await this.getFoodOrThrow(data.foodId);

        // Fetch food sizes
        const foodWithSizes = await this.prismaService.client.food.findUnique({
            where: { id: data.foodId },
            include: {
                sizes: {
                    where: { deleteAt: null },
                    include: { size: true }
                }
            }
        });
        if (!foodWithSizes) {
            throw new NotFoundException('Food not found');
        }

        let resolvedSizeId: number;
        if (data.foodSizeId) {
            const sizeMatch = foodWithSizes.sizes.find(s => s.id === data.foodSizeId);
            if (!sizeMatch) {
                throw new BadRequestException('Selected size does not belong to this food');
            }
            resolvedSizeId = data.foodSizeId;
        } else {
            const defaultSize = foodWithSizes.sizes.find(s => s.isDefault);
            if (!defaultSize) {
                throw new BadRequestException('Food does not have a default size configured');
            }
            resolvedSizeId = defaultSize.id;
        }

        const existsCartItem = await this.prismaService.client.cartItem.findFirst(
            {
                where: {
                    cartId: cart.id,
                    foodId: data.foodId,
                    foodSizeId: resolvedSizeId,
                },
            },
        );

        if (existsCartItem) {
            if (existsCartItem.quantity + data.quantity > 99) {
                throw new BadRequestException(
                    'Cart item quantity cannot exceed 99',
                );
            }

            await this.prismaService.client.cartItem.update({
                where: {
                    id: existsCartItem.id,
                },
                data: {
                    quantity: {
                        increment: data.quantity,
                    },
                    ...(data.fullText !== undefined && {
                        fullText: data.fullText,
                    }),
                },
            });

            return await this.getCart(userId);
        }

        await this.prismaService.client.cartItem.create({
            data: {
                cartId: cart.id,
                quantity: data.quantity,
                foodId: data.foodId,
                foodSizeId: resolvedSizeId,
                fullText: data.fullText,
            },
        });

        return await this.getCart(userId);
    }

    async updateCartItem(
        userId: number,
        cartItemId: number,
        data: UpdateCartItemDto,
    ) {
        const cart = await this.getUserCartOrThrow(userId);
        const cartItem = await this.prismaService.client.cartItem.findFirst({
            where: {
                id: cartItemId,
                cartId: cart.id,
            },
        });

        if (!cartItem) {
            throw new NotFoundException('Cart item not found');
        }

        if (data.quantity === 0) {
            await this.prismaService.client.cartItem.delete({
                id: cartItem.id,
            });
            return await this.getCart(userId);
        }

        await this.prismaService.client.cartItem.update({
            where: {
                id: cartItem.id,
            },
            data: {
                quantity: data.quantity,
            },
        });

        return await this.getCart(userId);
    }

    async deleteCartById(userId: number, cartItemId: number) {
        const cart = await this.getUserCartOrThrow(userId);
        const cartItem = await this.prismaService.client.cartItem.findFirst({
            where: {
                id: cartItemId,
                cartId: cart.id,
            },
        });

        if (!cartItem) {
            throw new NotFoundException('Cart item not found');
        }

        await this.prismaService.client.cartItem.delete({
            id: cartItem.id,
        });

        return await this.getCart(userId);
    }

    async clearCart(userId: number) {
        const cart = await this.getUserCartOrThrow(userId);

        await this.prismaService.client.cartItem.deleteMany({
            cartId: cart.id,
        });

        return {
            message: 'Cart cleared successfully',
        };
    }

    async clearCartByRestaurant(userId: number, restaurantId: number) {
        const cart = await this.getUserCartOrThrow(userId);

        await this.prismaService.client.cartItem.deleteMany({
            cartId: cart.id,
            food: {
                restaurantId,
            },
        });

        return await this.getCart(userId);
    }
}
