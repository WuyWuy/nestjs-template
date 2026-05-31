import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    CreateOrderDto,
    UpdateOrderStatus,
} from './dto/order.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { AddressService } from '../address/address.service';
import {
    OrderStatus,
    PaymentMethod,
    Prisma,
    Role,
    VoucherStatus,
    VoucherType,
} from '@prisma/client';
import { PaymentService } from '../payment/payment.service';

type FoodSnapshot = {
    id: number;
    name: string;
    price: Prisma.Decimal;
    restaurantId: number;
};

@Injectable()
export class OrderService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly addressService: AddressService,
        private readonly paymentService: PaymentService,
    ) {}

    private hasRole(roles: string[], role: Role) {
        return roles.includes(role);
    }

    private ensureCustomerAccess(orderUserId: number, requesterId: number) {
        if (orderUserId !== requesterId) {
            throw new ForbiddenException('You are not allowed to access this order');
        }
    }

    private ensureBusinessAccess(
        ownerId: number,
        requesterId: number,
        roles: string[],
    ) {
        if (
            this.hasRole(roles, Role.ADMIN) ||
            (this.hasRole(roles, Role.BUSINESS) && ownerId === requesterId)
        ) {
            return;
        }

        throw new ForbiddenException('You are not allowed to access this order');
    }

    private validateFoodsFromSameRestaurant(foods: FoodSnapshot[]) {
        if (foods.length === 0) {
            throw new BadRequestException('No foods provided');
        }

        const firstRestaurantId = foods[0].restaurantId;
        for (const food of foods) {
            if (food.restaurantId !== firstRestaurantId) {
                throw new BadRequestException(
                    'All foods must belong to the same restaurant',
                );
            }
        }
    }

    private calculateMoneyDiscount(
        totalPrice: Prisma.Decimal,
        discountAmount: number,
    ) {
        return Math.max(0, Number(totalPrice) - discountAmount);
    }

    private calculatePercentDiscount(
        totalPrice: Prisma.Decimal,
        discountPercent: number,
    ) {
        const normalizedPercent =
            discountPercent > 1 ? discountPercent / 100 : discountPercent;
        const discountAmount = Number(totalPrice) * normalizedPercent;
        return Math.max(0, Math.floor(Number(totalPrice) - discountAmount));
    }

    private async findOrderWithAccess(
        userId: number,
        roles: string[],
        orderId: number,
    ) {
        const order = await this.prismaService.client.order.findFirst({
            where: {
                id: orderId,
            },
            select: {
                id: true,
                userId: true,
                status: true,
                restaurantId: true,
                restaurant: {
                    select: {
                        id: true,
                        ownerId: true,
                        name: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (this.hasRole(roles, Role.CUSTOMER) && order.userId === userId) {
            return order;
        }

        this.ensureBusinessAccess(order.restaurant.ownerId, userId, roles);
        return order;
    }

    async createOrder(userId: number, data: CreateOrderDto) {
        return await this.prismaService.transaction(async (tx) => {
            let totalPrice = new Prisma.Decimal(0);
            let voucherId: number | undefined;
            let saleOff = 0;
            let voucherType: VoucherType | undefined;
            let currentVoucher:
                | {
                      id: number;
                      sale: number;
                      type: VoucherType;
                      status: VoucherStatus;
                      minimumOrderAmount: Prisma.Decimal;
                      maximumDiscountAmount: Prisma.Decimal | null;
                      startAt: Date | null;
                      endAt: Date | null;
                      restaurantId: number | null;
                  }
                | null = null;

            let addressId: number;
            if (data.customAddress) {
                const address = await this.addressService.createAddress(
                    data.customAddress,
                    tx,
                );
                addressId = address.id;
            } else if (data.savedAddressId) {
                const userAddress = await tx.userAddress.findFirst({
                    where: {
                        id: data.savedAddressId,
                        userId,
                        deleteAt: null,
                    },
                });

                if (!userAddress) {
                    throw new BadRequestException(
                        'This address does not belong to the user',
                    );
                }

                addressId = userAddress.addressId;
            } else {
                throw new BadRequestException('Address is required');
            }

            if (data.voucherId) {
                currentVoucher = await tx.voucher.findFirst({
                    where: {
                        id: data.voucherId,
                    },
                    select: {
                        id: true,
                        sale: true,
                        type: true,
                        status: true,
                        minimumOrderAmount: true,
                        maximumDiscountAmount: true,
                        startAt: true,
                        endAt: true,
                        restaurantId: true,
                    },
                });

                if (!currentVoucher) {
                    throw new BadRequestException('Voucher not found');
                }

                if (currentVoucher.status !== VoucherStatus.APPLYING) {
                    throw new BadRequestException('Voucher is not active');
                }

                const now = new Date();
                if (currentVoucher.startAt && currentVoucher.startAt > now) {
                    throw new BadRequestException(
                        'Voucher is not available yet',
                    );
                }
                if (currentVoucher.endAt && currentVoucher.endAt < now) {
                    throw new BadRequestException('Voucher has expired');
                }

                voucherId = currentVoucher.id;
                saleOff = currentVoucher.sale;
                voucherType = currentVoucher.type;
            }

            const restaurant = await tx.restaurant.findFirst({
                where: {
                    id: data.restaurantId,
                    approved: true,
                },
                select: {
                    id: true,
                    ownerId: true,
                },
            });

            if (!restaurant) {
                throw new BadRequestException('Restaurant not found');
            }

            if (
                currentVoucher?.restaurantId &&
                currentVoucher.restaurantId !== restaurant.id
            ) {
                throw new BadRequestException(
                    'Voucher does not belong to this restaurant',
                );
            }

            const orderFoodMap = new Map<
                number,
                { quantity: number; fullText: string }
            >();
            for (const orderFood of data.orderFoods) {
                orderFoodMap.set(orderFood.foodId, {
                    quantity: orderFood.quantity,
                    fullText: orderFood.fullText || '',
                });
            }

            const foods = await tx.food.findMany({
                where: {
                    id: {
                        in: [...orderFoodMap.keys()],
                    },
                },
                select: {
                    id: true,
                    name: true,
                    price: true,
                    restaurantId: true,
                },
            });

            if (foods.length !== orderFoodMap.size) {
                throw new BadRequestException(
                    'Some foods not found or have been deleted',
                );
            }

            this.validateFoodsFromSameRestaurant(foods);
            if (foods[0].restaurantId !== restaurant.id) {
                throw new BadRequestException(
                    'Foods do not belong to the selected restaurant',
                );
            }

            const order = await tx.order.create({
                data: {
                    restaurantId: data.restaurantId,
                    totalPrice: 0,
                    status: OrderStatus.PENDING,
                    userId,
                    voucherId,
                    addressId,
                    note: data.note ?? '',
                },
            });

            const orderFoodData = foods.map((food) => {
                const snapshot = orderFoodMap.get(food.id);
                if (!snapshot) {
                    throw new BadRequestException('Invalid order payload');
                }

                const itemTotal = food.price.mul(snapshot.quantity);
                totalPrice = totalPrice.plus(itemTotal);

                return {
                    orderId: order.id,
                    foodId: food.id,
                    quantity: snapshot.quantity,
                    fullText: snapshot.fullText,
                    price: itemTotal,
                };
            });

            await tx.orderFood.createMany({
                data: orderFoodData,
            });

                let finalPrice = Math.ceil(Number(totalPrice));
                if (
                    currentVoucher &&
                    Number(totalPrice) <
                        Number(currentVoucher.minimumOrderAmount)
                ) {
                    throw new BadRequestException(
                        'Order does not meet voucher minimum amount',
                    );
                }
                if (saleOff && voucherType) {
                    finalPrice =
                        voucherType === VoucherType.MONEY
                            ? this.calculateMoneyDiscount(totalPrice, saleOff)
                            : this.calculatePercentDiscount(totalPrice, saleOff);
                }
                if (
                    currentVoucher?.maximumDiscountAmount &&
                    Number(totalPrice) - finalPrice >
                        Number(currentVoucher.maximumDiscountAmount)
                ) {
                    finalPrice =
                        Number(totalPrice) -
                        Number(currentVoucher.maximumDiscountAmount);
                }

            const updatedOrder = await tx.order.update({
                where: {
                    id: order.id,
                },
                data: {
                    totalPrice: finalPrice,
                },
                select: {
                    id: true,
                    restaurantId: true,
                    totalPrice: true,
                    status: true,
                    userId: true,
                    addressId: true,
                    voucherId: true,
                    note: true,
                },
            });

            let paymentInformation: unknown;
            if (data.paymentMethod === PaymentMethod.MOMO) {
                paymentInformation = await this.paymentService.createMoMoPayment(
                    order.id,
                    finalPrice,
                    tx,
                );
            } else if (data.paymentMethod === PaymentMethod.CASH) {
                paymentInformation = await this.paymentService.createCashPayment(
                    order.id,
                    finalPrice,
                    tx,
                );
            } else {
                throw new BadRequestException('Invalid payment method');
            }

            if (data.clearCartAfterOrder ?? true) {
                const userCart = await tx.cart.findFirst({
                    where: {
                        userId,
                    },
                });

                if (userCart) {
                    await tx.cartItem.deleteMany({
                        cartId: userCart.id,
                        foodId: {
                            in: foods.map((food) => food.id),
                        },
                    });
                }
            }

            const conversation =
                await tx.conversation.findFirst({
                    where: {
                        orderId: order.id,
                    },
                });

            const ensuredConversation =
                conversation ??
                (await tx.conversation.create({
                    data: {
                        orderId: order.id,
                        customerId: userId,
                        sellerId: restaurant.ownerId,
                    },
                }));

            return {
                order: {
                    ...updatedOrder,
                    totalPrice: Number(updatedOrder.totalPrice),
                },
                items: orderFoodData.map((item) => ({
                    ...item,
                    price: Number(item.price),
                })),
                conversation: ensuredConversation,
                paymentInformation,
            };
        });
    }

    async getAllOrders(
        userId: number,
        roles: string[],
        limit: number,
        offset: number,
        status?: OrderStatus,
    ) {
        const isBusiness =
            this.hasRole(roles, Role.BUSINESS) || this.hasRole(roles, Role.ADMIN);

        const orders = await this.prismaService.client.order.findMany({
            where: isBusiness
                ? {
                      status,
                      restaurant: this.hasRole(roles, Role.ADMIN)
                          ? undefined
                          : {
                                ownerId: userId,
                            },
                  }
                : {
                      userId,
                      status,
                  },
            select: {
                id: true,
                totalPrice: true,
                status: true,
                address: {
                    select: {
                        id: true,
                        title: true,
                        fullText: true,
                    },
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
                orderFoods: {
                    select: {
                        quantity: true,
                        price: true,
                        food: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                            },
                        },
                    },
                },
                voucher: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                payments: {
                    select: {
                        id: true,
                        paymentStatus: true,
                        method: true,
                        amount: true,
                        createdAt: true,
                    },
                    take: 1,
                },
            },
            take: limit,
            skip: offset,
            orderBy: {
                id: 'desc',
            },
        });

        return orders.map((order) => ({
            ...order,
            totalPrice: Number(order.totalPrice),
            orderFoods: order.orderFoods.map((orderFood) => ({
                id: orderFood.food.id,
                name: orderFood.food.name,
                image: orderFood.food.image,
                quantity: orderFood.quantity,
                price: Number(orderFood.price),
            })),
            payment: order.payments[0]
                ? {
                      ...order.payments[0],
                      amount: Number(order.payments[0].amount),
                  }
                : null,
        }));
    }

    async getOrderDetail(userId: number, roles: string[], orderId: number) {
        await this.findOrderWithAccess(userId, roles, orderId);

        const order = await this.prismaService.client.order.findFirst({
            where: {
                id: orderId,
            },
            select: {
                id: true,
                totalPrice: true,
                status: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                    },
                },
                address: {
                    select: {
                        id: true,
                        title: true,
                        latitude: true,
                        longitude: true,
                        fullText: true,
                    },
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        phone: true,
                        ownerId: true,
                    },
                },
                orderFoods: {
                    select: {
                        id: true,
                        quantity: true,
                        fullText: true,
                        price: true,
                        food: {
                            select: {
                                id: true,
                                name: true,
                                image: true,
                                description: true,
                                label: true,
                            },
                        },
                    },
                },
                voucher: {
                    select: {
                        id: true,
                        name: true,
                        sale: true,
                        type: true,
                    },
                },
                note: true,
                payments: {
                    select: {
                        id: true,
                        amount: true,
                        method: true,
                        paymentStatus: true,
                        createdAt: true,
                    },
                    take: 1,
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        const conversation = await this.prismaService.client.conversation.findFirst({
            where: {
                orderId,
            },
            select: {
                id: true,
                orderId: true,
                customerId: true,
                sellerId: true,
                updatedAt: true,
            },
        });

        return {
            ...order,
            totalPrice: Number(order.totalPrice),
            orderFoods: order.orderFoods.map((item) => ({
                ...item,
                price: Number(item.price),
            })),
            payment: order.payments[0]
                ? {
                      ...order.payments[0],
                      amount: Number(order.payments[0].amount),
                  }
                : null,
            conversation,
        };
    }

    async deleteOrderById(userId: number, roles: string[], orderId: number) {
        const order = await this.findOrderWithAccess(userId, roles, orderId);

        if (this.hasRole(roles, Role.CUSTOMER)) {
            this.ensureCustomerAccess(order.userId, userId);
        }

        const cancellableStatuses: OrderStatus[] = [
            OrderStatus.PENDING,
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
        ];

        if (!cancellableStatuses.includes(order.status)) {
            throw new BadRequestException(
                'Only pending or active orders can be cancelled',
            );
        }

        await this.prismaService.client.order.update({
            where: {
                id: order.id,
            },
            data: {
                status: OrderStatus.CANCELLED,
            },
        });

        return {
            message: 'Order cancelled successfully',
        };
    }

    async updateOrderStatus(
        userId: number,
        roles: string[],
        orderId: number,
        data: UpdateOrderStatus,
    ) {
        const order = await this.findOrderWithAccess(userId, roles, orderId);

        if (this.hasRole(roles, Role.CUSTOMER)) {
            this.ensureCustomerAccess(order.userId, userId);
            if (data.status !== OrderStatus.CANCELLED) {
                throw new ForbiddenException(
                    'Customers are only allowed to cancel orders',
                );
            }
        }

        if (
            this.hasRole(roles, Role.BUSINESS) ||
            this.hasRole(roles, Role.ADMIN)
        ) {
            this.ensureBusinessAccess(order.restaurant.ownerId, userId, roles);
        }

        const updatedOrder = await this.prismaService.client.order.update({
            where: {
                id: order.id,
            },
            data: {
                status: data.status,
            },
        });

        return updatedOrder;
    }
}
