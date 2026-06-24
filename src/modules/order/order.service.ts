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
    NotificationType,
    RestaurantApprovalStatus,
    ConfirmedBy,
} from '@prisma/client';
import { PaymentService } from '../payment/payment.service';
import { CartService } from '../cart/cart.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEvent } from '../notification/events/notification.event';
import { RestaurantService } from '../restaurant/restaurant.service';
import {
    assertValidStatusTransition,
    buildOrderTimingFields,
    buildStatusUpdateData,
    CANCELLABLE_ORDER_STATUSES,
    HISTORY_ORDER_STATUSES,
    mapOrderStatusToFrontend,
    ONGOING_ORDER_STATUSES,
    ORDER_AUTO_CONFIRM_HOURS,
} from './order-status.helper';

type FoodSnapshot = {
    id: number;
    name: string;
    price: Prisma.Decimal;
    restaurantId: number;
};

type AddressCoordinates = {
    latitude: number | null;
    longitude: number | null;
};

@Injectable()
export class OrderService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly addressService: AddressService,
        private readonly paymentService: PaymentService,
        private readonly cartService: CartService,
        private readonly restaurantService: RestaurantService,
        private readonly eventEmitter: EventEmitter2,
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
                deliveredAt: true,
                confirmedAt: true,
                confirmedBy: true,
                autoConfirmAt: true,
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

    private assertAddressCoordinates(
        address: AddressCoordinates | null | undefined,
        label: string,
    ): asserts address is { latitude: number; longitude: number } {
        if (address?.latitude == null || address?.longitude == null) {
            throw new BadRequestException(
                `${label} address coordinates are required to calculate delivery fee`,
            );
        }
    }

    calculateDeliveryFee(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ): number {
        const distance = this.restaurantService.calculateDistance(
            lat1,
            lon1,
            lat2,
            lon2,
        );
        return 3 + Math.max(0, (distance - 2) * 0.4);
    }

    async createOrder(userId: number, data: CreateOrderDto) {
        const result = await this.prismaService.transaction(async (tx) => {
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
            let deliveryAddress: AddressCoordinates;
            if (data.customAddress) {
                const address = await this.addressService.createAddress(
                    data.customAddress,
                    tx,
                );
                addressId = address.id;
                deliveryAddress = {
                    latitude: address.latitude,
                    longitude: address.longitude,
                };
            } else if (data.savedAddressId) {
                const userAddress = await tx.userAddress.findFirst({
                    where: {
                        id: data.savedAddressId,
                        userId,
                        deleteAt: null,
                    },
                    select: {
                        addressId: true,
                        address: {
                            select: {
                                latitude: true,
                                longitude: true,
                            },
                        },
                    },
                });

                if (!userAddress) {
                    throw new BadRequestException(
                        'This address does not belong to the user',
                    );
                }

                addressId = userAddress.addressId;
                deliveryAddress = userAddress.address;
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
                    status: RestaurantApprovalStatus.APPROVED,
                },
                select: {
                    id: true,
                    ownerId: true,
                    address: {
                        select: {
                            latitude: true,
                            longitude: true,
                        },
                    },
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

            this.assertAddressCoordinates(restaurant.address, 'Restaurant');
            this.assertAddressCoordinates(deliveryAddress, 'Delivery');
            const deliveryFee = this.calculateDeliveryFee(
                restaurant.address.latitude,
                restaurant.address.longitude,
                deliveryAddress.latitude,
                deliveryAddress.longitude,
            );

            const foodIds = data.orderFoods.map(item => item.foodId);
            const foods = await tx.food.findMany({
                where: {
                    id: {
                        in: foodIds,
                    },
                },
                select: {
                    id: true,
                    name: true,
                    price: true,
                    restaurantId: true,
                    sizes: {
                        where: { deleteAt: null },
                        select: {
                            id: true,
                            price: true,
                            isDefault: true,
                            size: {
                                select: { name: true }
                            }
                        }
                    }
                },
            });

            // Prevent duplicate food IDs from skewing length comparison
            const uniqueFoodIdsInRequest = new Set(foodIds);
            if (foods.length !== uniqueFoodIdsInRequest.size) {
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

            const orderFoodData = [];
            for (const item of data.orderFoods) {
                const food = foods.find(f => f.id === item.foodId);
                if (!food) {
                    throw new BadRequestException(`Food with ID ${item.foodId} not found`);
                }

                let resolvedSize: { id: number; price: Prisma.Decimal; size: { name: string } };
                if (item.foodSizeId) {
                    const matchedSize = food.sizes.find(s => s.id === item.foodSizeId);
                    if (!matchedSize) {
                        throw new BadRequestException(`Selected size ${item.foodSizeId} does not belong to food ${food.name}`);
                    }
                    resolvedSize = matchedSize;
                } else {
                    const defaultSize = food.sizes.find(s => s.isDefault);
                    if (!defaultSize) {
                        throw new BadRequestException(`Food ${food.name} does not have a default size configured`);
                    }
                    resolvedSize = defaultSize;
                }

                const itemPrice = resolvedSize.price;
                const itemTotal = itemPrice.mul(item.quantity);
                totalPrice = totalPrice.plus(itemTotal);

                orderFoodData.push({
                    orderId: order.id,
                    foodId: food.id,
                    foodSizeId: resolvedSize.id,
                    sizeName: resolvedSize.size.name,
                    quantity: item.quantity,
                    fullText: item.fullText || '',
                    price: itemTotal,
                });
            }

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
            finalPrice += deliveryFee;

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
                    deliveryFee,
                },
                items: orderFoodData.map((item) => ({
                    ...item,
                    price: Number(item.price),
                })),
                conversation: ensuredConversation,
                paymentInformation,
            };
        });

        try {
            const customerObj = await this.prismaService.client.user.findUnique({
                where: { id: userId },
                select: { name: true }
            });
            const customerName = customerObj?.name || 'Customer';

            const restaurant = await this.prismaService.client.restaurant.findUnique({
                where: { id: data.restaurantId },
                select: { ownerId: true }
            });

            if (restaurant?.ownerId) {
                const orderFoodDetails = [];
                for (const item of data.orderFoods) {
                    const foodObj = await this.prismaService.client.food.findUnique({
                        where: { id: item.foodId },
                        select: { name: true }
                    });
                    if (foodObj) {
                        orderFoodDetails.push(`${item.quantity}x ${foodObj.name}`);
                    }
                }
                const itemSummary = orderFoodDetails.join(', ');

                this.eventEmitter.emit('notification.send', {
                    recipientUserId: restaurant.ownerId,
                    title: 'New Order Received',
                    body: `New order #${result.order.id} from ${customerName}: ${itemSummary}. Total: $${result.order.totalPrice}`,
                    type: NotificationType.ORDER,
                    targetType: 'ORDER',
                    targetId: result.order.id,
                    actorId: userId,
                    metadata: {
                        actions: ['ACCEPT_ORDER', 'REJECT_ORDER'],
                        orderId: result.order.id,
                        customerName,
                        totalPrice: result.order.totalPrice,
                        itemSummary,
                    }
                } as NotificationEvent);
            }
        } catch (err) {
            console.error('Error emitting new order notification:', err);
        }

        return result;
    }

    async getAllOrders(
        userId: number,
        roles: string[],
        limit: number,
        offset: number,
        status?: string,
    ) {
        const isBusiness =
            this.hasRole(roles, Role.BUSINESS) || this.hasRole(roles, Role.ADMIN);

        let statusFilter: any = undefined;

        if (status) {
            if (status === 'ongoing') {
                statusFilter = {
                    in: ONGOING_ORDER_STATUSES,
                };
            } else if (status === 'history') {
                statusFilter = {
                    in: HISTORY_ORDER_STATUSES,
                };
            } else if (status === 'confirmed') {
                statusFilter = OrderStatus.CONFIRMED;
            } else {
                if (Object.values(OrderStatus).includes(status as OrderStatus)) {
                    statusFilter = status as OrderStatus;
                } else {
                    throw new BadRequestException('Invalid status parameter');
                }
            }
        }

        const orders = await this.prismaService.client.order.findMany({
            where: isBusiness
                ? {
                      status: statusFilter,
                      restaurant: this.hasRole(roles, Role.ADMIN)
                          ? undefined
                          : {
                                ownerId: userId,
                            },
                  }
                : {
                      userId,
                      status: statusFilter,
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
                        foodSizeId: true,
                        sizeName: true,
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

        const mappedOrders = orders.map((order) => {
            const paymentDate = order.payments[0]?.createdAt ?? new Date();
            const dateStr = paymentDate instanceof Date ? paymentDate.toISOString() : new Date(paymentDate).toISOString();
            const itemCount = order.orderFoods.reduce((acc, f) => acc + f.quantity, 0);
            const { status: feStatus, status_step } = mapOrderStatusToFrontend(order.status);

            return {
                ...order,
                totalPrice: Number(order.totalPrice),
                item_count: itemCount,
                type: 'FOOD',
                date: dateStr,
                status: feStatus,
                status_step,
                backend_status: order.status,
                orderFoods: order.orderFoods.map((orderFood) => ({
                    id: orderFood.food.id,
                    name: orderFood.food.name,
                    image: orderFood.food.image,
                    quantity: orderFood.quantity,
                    price: Number(orderFood.price),
                    foodSizeId: orderFood.foodSizeId,
                    sizeName: orderFood.sizeName,
                })),
                payment: order.payments[0]
                    ? {
                          ...order.payments[0],
                          amount: Number(order.payments[0].amount),
                      }
                    : null,
            };
        });

        if (status === 'ongoing') {
            return { ongoing_orders: mappedOrders };
        } else if (status === 'history') {
            return { history_orders: mappedOrders };
        }

        return mappedOrders;
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
                deliveredAt: true,
                confirmedAt: true,
                confirmedBy: true,
                autoConfirmAt: true,
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
                        estimatedDeliveryTime: true,
                    },
                },
                orderFoods: {
                    select: {
                        id: true,
                        quantity: true,
                        fullText: true,
                        price: true,
                        foodSizeId: true,
                        sizeName: true,
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

        const paymentDate = order.payments[0]?.createdAt ?? new Date();
        const estimatedMinutes = order.restaurant?.estimatedDeliveryTime ?? 20;
        const expectedArrival = new Date(new Date(paymentDate).getTime() + estimatedMinutes * 60000);

        const { status: feStatus, status_step } = mapOrderStatusToFrontend(order.status);

        return {
            ...order,
            totalPrice: Number(order.totalPrice),
            expected_arrival: expectedArrival.toISOString(),
            status: feStatus,
            status_step,
            backend_status: order.status,
            ...buildOrderTimingFields(order),
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

    async getOrderStatus(userId: number, roles: string[], orderId: number) {
        const order = await this.findOrderWithAccess(userId, roles, orderId);

        const payment = await this.prismaService.client.payment.findFirst({
            where: { orderId: order.id },
            select: { updatedAt: true },
        });

        const { status: feStatus, status_step } = mapOrderStatusToFrontend(order.status);

        return {
            order_id: order.id,
            status: feStatus,
            status_step,
            updated_at: (payment?.updatedAt ?? new Date()).toISOString(),
            backend_status: order.status,
            ...buildOrderTimingFields(order),
        };
    }

    async confirmReceived(userId: number, orderId: number) {
        const order = await this.findOrderWithAccess(userId, [Role.CUSTOMER], orderId);
        this.ensureCustomerAccess(order.userId, userId);
        assertValidStatusTransition(
            order.status,
            OrderStatus.CONFIRMED,
            [Role.CUSTOMER],
        );

        const updatedOrder = await this.prismaService.client.order.update({
            where: { id: order.id },
            data: buildStatusUpdateData(OrderStatus.CONFIRMED, ConfirmedBy.CUSTOMER),
        });

        await this.emitOrderStatusNotification(
            order.userId,
            order.id,
            OrderStatus.CONFIRMED,
            userId,
            ConfirmedBy.CUSTOMER,
        );

        const { status: feStatus, status_step } = mapOrderStatusToFrontend(
            updatedOrder.status,
        );

        return {
            order_id: updatedOrder.id,
            status: feStatus,
            status_step,
            backend_status: updatedOrder.status,
            confirmed_by: updatedOrder.confirmedBy,
            confirmed_at: updatedOrder.confirmedAt?.toISOString() ?? null,
            message: 'Order receipt confirmed successfully',
        };
    }

    async autoConfirmStaleOrders(): Promise<number> {
        const staleOrders = await this.prismaService.client.order.findMany({
            where: {
                status: OrderStatus.DELIVERED,
                autoConfirmAt: {
                    lte: new Date(),
                },
            },
            select: {
                id: true,
                userId: true,
            },
        });

        for (const order of staleOrders) {
            await this.prismaService.client.order.update({
                where: { id: order.id },
                data: buildStatusUpdateData(OrderStatus.CONFIRMED, ConfirmedBy.SYSTEM),
            });

            await this.emitOrderStatusNotification(
                order.userId,
                order.id,
                OrderStatus.CONFIRMED,
                undefined,
                ConfirmedBy.SYSTEM,
            );
        }

        return staleOrders.length;
    }

    async reorder(userId: number, orderId: number) {
        const order = await this.prismaService.client.order.findUnique({
            where: { id: orderId },
            include: {
                address: {
                    select: {
                        latitude: true,
                        longitude: true,
                    },
                },
                restaurant: {
                    select: {
                        address: {
                            select: {
                                latitude: true,
                                longitude: true,
                            },
                        },
                    },
                },
                orderFoods: {
                    include: {
                        food: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new ForbiddenException('You can only reorder your own orders');
        }

        this.assertAddressCoordinates(order.restaurant.address, 'Restaurant');
        this.assertAddressCoordinates(order.address, 'Delivery');
        const deliveryFee = this.calculateDeliveryFee(
            order.restaurant.address.latitude,
            order.restaurant.address.longitude,
            order.address.latitude,
            order.address.longitude,
        );

        const activeCartItems: { foodId: number; foodSizeId: number; quantity: number }[] = [];
        for (const orderFood of order.orderFoods) {
            if (!orderFood.food || orderFood.food.deleteAt || !orderFood.food.isAvailable) {
                continue;
            }

            let resolvedSizeId: number | null = null;
            if (orderFood.foodSizeId) {
                const sizeMatch = await this.prismaService.client.foodSize.findFirst({
                    where: {
                        id: orderFood.foodSizeId,
                        foodId: orderFood.foodId,
                        deleteAt: null,
                    },
                });
                if (sizeMatch) {
                    resolvedSizeId = sizeMatch.id;
                }
            }

            if (!resolvedSizeId) {
                const defaultSize = await this.prismaService.client.foodSize.findFirst({
                    where: {
                        foodId: orderFood.foodId,
                        isDefault: true,
                        deleteAt: null,
                    },
                });
                if (defaultSize) {
                    resolvedSizeId = defaultSize.id;
                }
            }

            if (resolvedSizeId) {
                activeCartItems.push({
                    foodId: orderFood.foodId,
                    foodSizeId: resolvedSizeId,
                    quantity: orderFood.quantity,
                });
            }
        }

        if (activeCartItems.length === 0) {
            throw new BadRequestException('None of the items in this order are currently available for purchase');
        }

        await this.prismaService.transaction(async (tx) => {
            let cart = await tx.cart.findFirst({
                where: { userId },
            });

            if (!cart) {
                cart = await tx.cart.create({
                    data: { userId },
                });
            }

            const existingCartItems = await tx.cartItem.findMany({
                where: { cartId: cart.id, deleteAt: null },
                include: { food: true },
            });

            const hasDifferentRestaurant = existingCartItems.some(
                (item) => item.food.restaurantId !== order.restaurantId,
            );

            if (hasDifferentRestaurant) {
                await tx.cartItem.deleteMany({
                    cartId: cart.id,
                });
            }

            for (const item of activeCartItems) {
                const existing = await tx.cartItem.findFirst({
                    where: {
                        cartId: cart.id,
                        foodId: item.foodId,
                        foodSizeId: item.foodSizeId,
                        deleteAt: null,
                    },
                });

                if (existing) {
                    await tx.cartItem.update({
                        where: { id: existing.id },
                        data: { quantity: existing.quantity + item.quantity },
                    });
                } else {
                    await tx.cartItem.create({
                        data: {
                            cartId: cart.id,
                            foodId: item.foodId,
                            foodSizeId: item.foodSizeId,
                            quantity: item.quantity,
                        },
                    });
                }
            }
        });

        const cart = await this.cartService.getCart(userId);

        return {
            ...cart,
            deliveryFee,
            totalPrice: cart.subtotal + deliveryFee,
        };
    }

    async deleteOrderById(userId: number, roles: string[], orderId: number) {
        const order = await this.findOrderWithAccess(userId, roles, orderId);

        if (this.hasRole(roles, Role.CUSTOMER)) {
            this.ensureCustomerAccess(order.userId, userId);
        }

        if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
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
                autoConfirmAt: null,
            },
        });

        try {
            this.eventEmitter.emit('notification.send', {
                recipientUserId: order.userId,
                title: 'Order Cancelled',
                body: `Your order #${order.id} has been cancelled.`,
                type: NotificationType.ORDER,
                targetType: 'ORDER',
                targetId: order.id,
                actorId: userId,
                metadata: {
                    orderId: order.id,
                    status: OrderStatus.CANCELLED,
                }
            } as NotificationEvent);
        } catch (err) {
            console.error('Error emitting cancel order notification:', err);
        }

        return {
            message: 'Order cancelled successfully',
        };
    }

    async cancelOrderCompatible(userId: number, roles: string[], orderId: number) {
        const order = await this.findOrderWithAccess(userId, roles, orderId);

        if (this.hasRole(roles, Role.CUSTOMER)) {
            this.ensureCustomerAccess(order.userId, userId);
        }

        if (!CANCELLABLE_ORDER_STATUSES.includes(order.status)) {
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
                autoConfirmAt: null,
            },
        });

        try {
            this.eventEmitter.emit('notification.send', {
                recipientUserId: order.userId,
                title: 'Order Cancelled',
                body: `Your order #${order.id} has been cancelled.`,
                type: NotificationType.ORDER,
                targetType: 'ORDER',
                targetId: order.id,
                actorId: userId,
                metadata: {
                    orderId: order.id,
                    status: OrderStatus.CANCELLED,
                }
            } as NotificationEvent);
        } catch (err) {
            console.error('Error emitting cancel order notification:', err);
        }

        const { status: feStatus, status_step } = mapOrderStatusToFrontend(OrderStatus.CANCELLED);

        return {
            order_id: order.id,
            new_status: OrderStatus.CANCELLED,
            status: feStatus,
            status_step,
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
        }

        if (
            this.hasRole(roles, Role.BUSINESS) ||
            this.hasRole(roles, Role.ADMIN)
        ) {
            this.ensureBusinessAccess(order.restaurant.ownerId, userId, roles);
        }

        assertValidStatusTransition(order.status, data.status, roles);

        const updatedOrder = await this.prismaService.client.order.update({
            where: {
                id: order.id,
            },
            data: buildStatusUpdateData(data.status),
        });

        await this.emitOrderStatusNotification(
            order.userId,
            order.id,
            data.status,
            userId,
        );

        return updatedOrder;
    }

    private async emitOrderStatusNotification(
        recipientUserId: number,
        orderId: number,
        status: OrderStatus,
        actorId?: number,
        confirmedBy?: ConfirmedBy,
    ) {
        try {
            let title = 'Order Update';
            let body = `Your order #${orderId} status has been updated to ${status}.`;
            const metadata: Record<string, unknown> = {
                orderId,
                status,
            };

            switch (status) {
                case OrderStatus.PREPARING:
                    title = 'Preparing Your Order';
                    body = `The restaurant has accepted and is preparing your order #${orderId}.`;
                    break;
                case OrderStatus.DELIVERING:
                    title = 'Order Out for Delivery';
                    body = `Your order #${orderId} is on the way!`;
                    break;
                case OrderStatus.DELIVERED:
                    title = 'Order Delivered';
                    body = `Your order #${orderId} has been delivered. Please confirm receipt within ${ORDER_AUTO_CONFIRM_HOURS} hours.`;
                    metadata.actions = ['CONFIRM_RECEIVED'];
                    break;
                case OrderStatus.CONFIRMED:
                    if (confirmedBy === ConfirmedBy.SYSTEM) {
                        title = 'Order Completed';
                        body = `Your order #${orderId} was automatically completed after ${ORDER_AUTO_CONFIRM_HOURS} hours.`;
                    } else {
                        title = 'Order Completed';
                        body = `Thanks for confirming receipt of order #${orderId}.`;
                    }
                    metadata.confirmedBy = confirmedBy ?? ConfirmedBy.CUSTOMER;
                    break;
                case OrderStatus.CANCELLED:
                    title = 'Order Cancelled';
                    body = `Your order #${orderId} has been cancelled.`;
                    break;
            }

            this.eventEmitter.emit('notification.send', {
                recipientUserId,
                title,
                body,
                type: NotificationType.ORDER,
                targetType: 'ORDER',
                targetId: orderId,
                actorId,
                metadata,
            } as NotificationEvent);
        } catch (err) {
            console.error('Error emitting update order status notification:', err);
        }
    }
}
