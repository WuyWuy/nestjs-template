jest.mock('@prisma/client', () => {
    class MockDecimal {
        private readonly value: number;

        constructor(value: number | string) {
            this.value = Number(value);
        }

        plus(other: MockDecimal | number) {
            return new MockDecimal(this.value + Number(other));
        }

        mul(other: number) {
            return new MockDecimal(this.value * other);
        }

        valueOf() {
            return this.value;
        }

        toString() {
            return String(this.value);
        }
    }

    return {
        Role: {
            ADMIN: 'ADMIN',
            BUSINESS: 'BUSINESS',
            CUSTOMER: 'CUSTOMER',
        },
        OrderStatus: {
            PENDING: 'PENDING',
            CONFIRMED: 'CONFIRMED',
            PREPARING: 'PREPARING',
            DELIVERING: 'DELIVERING',
            DELIVERED: 'DELIVERED',
            CANCELLED: 'CANCELLED',
        },
        PaymentMethod: {
            CASH: 'CASH',
            MOMO: 'MOMO',
        },
        VoucherStatus: {
            APPLYING: 'APPLYING',
            ENDED: 'ENDED',
        },
        VoucherType: {
            MONEY: 'MONEY',
            PERCENT: 'PERCENT',
        },
        NotificationType: {
            ORDER: 'ORDER',
        },
        Prisma: {
            Decimal: MockDecimal,
            defineExtension: jest.fn((extension) => extension),
            getExtensionContext: jest.fn(),
            TransactionIsolationLevel: {},
        },
        PrismaClient: class {
            $extends() {
                return this;
            }
        },
    };
});

import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import {
    OrderStatus,
    PaymentMethod,
    Prisma,
    Role,
    VoucherStatus,
    VoucherType,
} from '@prisma/client';
import { OrderService } from './order.service';

describe('OrderService', () => {
    let service: OrderService;
    let prismaService: any;
    let addressService: { createAddress: jest.Mock };
    let paymentService: {
        createMoMoPayment: jest.Mock;
        createCashPayment: jest.Mock;
    };
    let cartService: { getCart: jest.Mock };
    let eventEmitter: { emit: jest.Mock };
    let tx: any;

    const decimal = (value: number) => new Prisma.Decimal(value);

    const accessOrder = {
        id: 1,
        userId: 99,
        status: OrderStatus.PENDING,
        restaurantId: 7,
        restaurant: {
            id: 7,
            ownerId: 55,
            name: 'Rice House',
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        tx = {
            userAddress: {
                findFirst: jest.fn(),
            },
            voucher: {
                findFirst: jest.fn(),
            },
            restaurant: {
                findFirst: jest.fn(),
            },
            food: {
                findMany: jest.fn(),
            },
            order: {
                create: jest.fn(),
                update: jest.fn(),
            },
            orderFood: {
                createMany: jest.fn(),
            },
            cart: {
                findFirst: jest.fn(),
                create: jest.fn(),
            },
            cartItem: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
                deleteMany: jest.fn(),
            },
            conversation: {
                findFirst: jest.fn(),
                create: jest.fn(),
            },
        };

        prismaService = {
            client: {
                order: {
                    findFirst: jest.fn(),
                    findMany: jest.fn(),
                    findUnique: jest.fn(),
                    update: jest.fn(),
                },
                user: {
                    findUnique: jest.fn(),
                },
                restaurant: {
                    findUnique: jest.fn(),
                },
                food: {
                    findUnique: jest.fn(),
                },
                foodSize: {
                    findFirst: jest.fn(),
                },
                conversation: {
                    findFirst: jest.fn(),
                },
                payment: {
                    findFirst: jest.fn(),
                },
            },
            transaction: jest.fn((callback) => callback(tx)),
        };
        addressService = {
            createAddress: jest.fn(),
        };
        paymentService = {
            createMoMoPayment: jest.fn(),
            createCashPayment: jest.fn(),
        };
        cartService = {
            getCart: jest.fn(),
        };
        eventEmitter = {
            emit: jest.fn(),
        };

        service = new OrderService(
            prismaService,
            addressService as any,
            paymentService as any,
            cartService as any,
            eventEmitter as any,
        );
    });

    it('should create order with saved address, cash payment and notification', async () => {
        tx.userAddress.findFirst.mockResolvedValueOnce({
            id: 2,
            addressId: 11,
        });
        tx.restaurant.findFirst.mockResolvedValueOnce({
            id: 7,
            ownerId: 55,
        });
        tx.food.findMany.mockResolvedValueOnce([
            {
                id: 3,
                name: 'Chicken rice',
                price: decimal(10),
                restaurantId: 7,
                sizes: [
                    {
                        id: 30,
                        price: decimal(12),
                        isDefault: true,
                        size: { name: 'Regular' },
                    },
                ],
            },
        ]);
        tx.order.create.mockResolvedValueOnce({
            id: 100,
        });
        tx.order.update.mockResolvedValueOnce({
            id: 100,
            restaurantId: 7,
            totalPrice: decimal(24),
            status: OrderStatus.PENDING,
            userId: 99,
            addressId: 11,
            voucherId: undefined,
            note: 'Less spicy',
        });
        paymentService.createCashPayment.mockResolvedValueOnce({
            method: PaymentMethod.CASH,
            amount: 24,
        });
        tx.cart.findFirst.mockResolvedValueOnce({ id: 5 });
        tx.conversation.findFirst.mockResolvedValueOnce(null);
        tx.conversation.create.mockResolvedValueOnce({
            id: 9,
            orderId: 100,
        });
        prismaService.client.user.findUnique.mockResolvedValueOnce({
            name: 'Huy',
        });
        prismaService.client.restaurant.findUnique.mockResolvedValueOnce({
            ownerId: 55,
        });
        prismaService.client.food.findUnique.mockResolvedValueOnce({
            name: 'Chicken rice',
        });

        const result = await service.createOrder(99, {
            restaurantId: 7,
            savedAddressId: 2,
            orderFoods: [{ foodId: 3, quantity: 2, fullText: '' }],
            note: 'Less spicy',
            paymentMethod: PaymentMethod.CASH,
        });

        expect(tx.order.create).toHaveBeenCalledWith({
            data: {
                restaurantId: 7,
                totalPrice: 0,
                status: OrderStatus.PENDING,
                userId: 99,
                voucherId: undefined,
                addressId: 11,
                note: 'Less spicy',
            },
        });
        expect(tx.orderFood.createMany).toHaveBeenCalledWith({
            data: [
                {
                    orderId: 100,
                    foodId: 3,
                    foodSizeId: 30,
                    sizeName: 'Regular',
                    quantity: 2,
                    fullText: '',
                    price: decimal(24),
                },
            ],
        });
        expect(paymentService.createCashPayment).toHaveBeenCalledWith(
            100,
            24,
            tx,
        );
        expect(tx.cartItem.deleteMany).toHaveBeenCalledWith({
            cartId: 5,
            foodId: {
                in: [3],
            },
        });
        expect(eventEmitter.emit).toHaveBeenCalledWith(
            'notification.send',
            expect.objectContaining({
                recipientUserId: 55,
                targetId: 100,
                actorId: 99,
            }),
        );
        expect(result).toEqual({
            order: {
                id: 100,
                restaurantId: 7,
                totalPrice: 24,
                status: OrderStatus.PENDING,
                userId: 99,
                addressId: 11,
                voucherId: undefined,
                note: 'Less spicy',
            },
            items: [
                {
                    orderId: 100,
                    foodId: 3,
                    foodSizeId: 30,
                    sizeName: 'Regular',
                    quantity: 2,
                    fullText: '',
                    price: 24,
                },
            ],
            conversation: {
                id: 9,
                orderId: 100,
            },
            paymentInformation: {
                method: PaymentMethod.CASH,
                amount: 24,
            },
        });
    });

    it('should create order with custom address and momo payment', async () => {
        addressService.createAddress.mockResolvedValueOnce({ id: 22 });
        tx.restaurant.findFirst.mockResolvedValueOnce({
            id: 7,
            ownerId: 55,
        });
        tx.food.findMany.mockResolvedValueOnce([
            {
                id: 3,
                name: 'Noodles',
                price: decimal(10),
                restaurantId: 7,
                sizes: [
                    {
                        id: 31,
                        price: decimal(20),
                        isDefault: true,
                        size: { name: 'Large' },
                    },
                ],
            },
        ]);
        tx.order.create.mockResolvedValueOnce({ id: 101 });
        tx.order.update.mockResolvedValueOnce({
            id: 101,
            restaurantId: 7,
            totalPrice: decimal(20),
            status: OrderStatus.PENDING,
            userId: 99,
            addressId: 22,
            voucherId: undefined,
            note: '',
        });
        paymentService.createMoMoPayment.mockResolvedValueOnce({
            payUrl: 'https://pay.local',
        });
        tx.conversation.findFirst.mockResolvedValueOnce({
            id: 12,
            orderId: 101,
        });

        const result = await service.createOrder(99, {
            restaurantId: 7,
            customAddress: {
                title: 'Home',
                latitude: 10,
                longitude: 106,
                fullText: 'District 1',
            },
            orderFoods: [{ foodId: 3, quantity: 1, fullText: '' }],
            paymentMethod: PaymentMethod.MOMO,
            clearCartAfterOrder: false,
        });

        expect(addressService.createAddress).toHaveBeenCalledWith(
            {
                title: 'Home',
                latitude: 10,
                longitude: 106,
                fullText: 'District 1',
            },
            tx,
        );
        expect(paymentService.createMoMoPayment).toHaveBeenCalledWith(
            101,
            20,
            tx,
        );
        expect(tx.cart.findFirst).not.toHaveBeenCalled();
        expect(result.paymentInformation).toEqual({
            payUrl: 'https://pay.local',
        });
    });

    it('should reject create order when address is missing', async () => {
        await expect(
            service.createOrder(99, {
                restaurantId: 7,
                orderFoods: [{ foodId: 3, quantity: 1, fullText: '' }],
                paymentMethod: PaymentMethod.CASH,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should reject create order when voucher is inactive', async () => {
        tx.userAddress.findFirst.mockResolvedValueOnce({
            id: 2,
            addressId: 11,
        });
        tx.voucher.findFirst.mockResolvedValueOnce({
            id: 8,
            sale: 10,
            type: VoucherType.MONEY,
            status: VoucherStatus.ENDED,
            minimumOrderAmount: decimal(0),
            maximumDiscountAmount: null,
            startAt: null,
            endAt: null,
            restaurantId: null,
        });

        await expect(
            service.createOrder(99, {
                restaurantId: 7,
                voucherId: 8,
                savedAddressId: 2,
                orderFoods: [{ foodId: 3, quantity: 1, fullText: '' }],
                paymentMethod: PaymentMethod.CASH,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should list customer orders with normalized frontend status', async () => {
        const createdAt = new Date('2025-01-01T00:00:00.000Z');
        prismaService.client.order.findMany.mockResolvedValueOnce([
            {
                id: 10,
                totalPrice: decimal(30),
                status: OrderStatus.PREPARING,
                address: {
                    id: 1,
                    title: 'Home',
                    fullText: 'District 1',
                },
                restaurant: {
                    id: 7,
                    name: 'Rice House',
                    image: 'rice.jpg',
                },
                orderFoods: [
                    {
                        quantity: 2,
                        price: decimal(15),
                        foodSizeId: 30,
                        sizeName: 'Regular',
                        food: {
                            id: 3,
                            name: 'Chicken rice',
                            image: 'rice.jpg',
                        },
                    },
                ],
                voucher: null,
                payments: [
                    {
                        id: 4,
                        paymentStatus: 'PAID',
                        method: PaymentMethod.CASH,
                        amount: decimal(30),
                        createdAt,
                    },
                ],
            },
        ]);

        const result = await service.getAllOrders(
            99,
            [Role.CUSTOMER],
            20,
            0,
            'ongoing',
        );

        expect(prismaService.client.order.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    userId: 99,
                    status: {
                        in: [
                            OrderStatus.PENDING,
                            OrderStatus.CONFIRMED,
                            OrderStatus.PREPARING,
                            OrderStatus.DELIVERING,
                        ],
                    },
                },
            }),
        );
        expect(result).toEqual({
            ongoing_orders: [
                expect.objectContaining({
                    id: 10,
                    totalPrice: 30,
                    item_count: 2,
                    status: 'PREPARING',
                    status_step: 1,
                    backend_status: OrderStatus.PREPARING,
                    payment: expect.objectContaining({
                        amount: 30,
                    }),
                    orderFoods: [
                        {
                            id: 3,
                            name: 'Chicken rice',
                            image: 'rice.jpg',
                            quantity: 2,
                            price: 15,
                            foodSizeId: 30,
                            sizeName: 'Regular',
                        },
                    ],
                }),
            ],
        });
    });

    it('should reject invalid order status filter', async () => {
        await expect(
            service.getAllOrders(99, [Role.CUSTOMER], 20, 0, 'bad-status'),
        ).rejects.toThrow(BadRequestException);
    });

    it('should return order detail when requester has access', async () => {
        const paidAt = new Date('2025-01-01T00:00:00.000Z');
        prismaService.client.order.findFirst
            .mockResolvedValueOnce(accessOrder)
            .mockResolvedValueOnce({
                id: 1,
                totalPrice: decimal(45),
                status: OrderStatus.DELIVERING,
                user: {
                    id: 99,
                    name: 'Huy',
                    email: 'huy@example.com',
                    phone: '0909',
                },
                address: {
                    id: 11,
                    title: 'Home',
                    latitude: 10,
                    longitude: 106,
                    fullText: 'District 1',
                },
                restaurant: {
                    id: 7,
                    name: 'Rice House',
                    image: 'rice.jpg',
                    phone: '1900',
                    ownerId: 55,
                    estimatedDeliveryTime: 30,
                },
                orderFoods: [
                    {
                        id: 6,
                        quantity: 3,
                        fullText: '',
                        price: decimal(45),
                        foodSizeId: 30,
                        sizeName: 'Regular',
                        food: {
                            id: 3,
                            name: 'Chicken rice',
                            image: 'rice.jpg',
                            description: 'Good',
                            label: 'Best',
                        },
                    },
                ],
                voucher: null,
                note: '',
                payments: [
                    {
                        id: 2,
                        amount: decimal(45),
                        method: PaymentMethod.CASH,
                        paymentStatus: 'PAID',
                        createdAt: paidAt,
                    },
                ],
            });
        prismaService.client.conversation.findFirst.mockResolvedValueOnce({
            id: 88,
            orderId: 1,
            customerId: 99,
            sellerId: 55,
            updatedAt: paidAt,
        });

        const result = await service.getOrderDetail(99, [Role.CUSTOMER], 1);

        expect(result).toEqual(
            expect.objectContaining({
                id: 1,
                totalPrice: 45,
                expected_arrival: '2025-01-01T00:30:00.000Z',
                status: 'ON_THE_WAY',
                status_step: 2,
                backend_status: OrderStatus.DELIVERING,
                payment: expect.objectContaining({
                    amount: 45,
                }),
                conversation: expect.objectContaining({
                    id: 88,
                }),
            }),
        );
    });

    it('should deny order detail when customer owns another order', async () => {
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            ...accessOrder,
            userId: 100,
        });

        await expect(
            service.getOrderDetail(99, [Role.CUSTOMER], 1),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should return order status with frontend mapping', async () => {
        const updatedAt = new Date('2025-01-02T00:00:00.000Z');
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            ...accessOrder,
            status: OrderStatus.CANCELLED,
        });
        prismaService.client.payment.findFirst.mockResolvedValueOnce({
            updatedAt,
        });

        const result = await service.getOrderStatus(99, [Role.CUSTOMER], 1);

        expect(result).toEqual({
            order_id: 1,
            status: 'CANCELED',
            status_step: -1,
            updated_at: '2025-01-02T00:00:00.000Z',
            backend_status: OrderStatus.CANCELLED,
        });
    });

    it('should reorder available items into cart', async () => {
        prismaService.client.order.findUnique.mockResolvedValueOnce({
            id: 1,
            userId: 99,
            restaurantId: 7,
            orderFoods: [
                {
                    foodId: 3,
                    foodSizeId: 30,
                    quantity: 2,
                    food: {
                        id: 3,
                        isAvailable: true,
                        deleteAt: null,
                    },
                },
            ],
        });
        prismaService.client.foodSize.findFirst.mockResolvedValueOnce({
            id: 30,
        });
        tx.cart.findFirst.mockResolvedValueOnce({
            id: 5,
        });
        tx.cartItem.findMany.mockResolvedValueOnce([]);
        tx.cartItem.findFirst.mockResolvedValueOnce(null);
        cartService.getCart.mockResolvedValueOnce({
            id: 5,
            items: [{ foodId: 3 }],
        });

        const result = await service.reorder(99, 1);

        expect(tx.cartItem.create).toHaveBeenCalledWith({
            data: {
                cartId: 5,
                foodId: 3,
                foodSizeId: 30,
                quantity: 2,
            },
        });
        expect(result).toEqual({
            id: 5,
            items: [{ foodId: 3 }],
        });
    });

    it('should reject reorder for unavailable order items', async () => {
        prismaService.client.order.findUnique.mockResolvedValueOnce({
            id: 1,
            userId: 99,
            restaurantId: 7,
            orderFoods: [
                {
                    foodId: 3,
                    foodSizeId: 30,
                    quantity: 2,
                    food: {
                        id: 3,
                        isAvailable: false,
                        deleteAt: null,
                    },
                },
            ],
        });

        await expect(service.reorder(99, 1)).rejects.toThrow(
            BadRequestException,
        );
    });

    it('should throw NotFoundException when reorder order does not exist', async () => {
        prismaService.client.order.findUnique.mockResolvedValueOnce(null);

        await expect(service.reorder(99, 404)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should cancel pending order and emit notification', async () => {
        prismaService.client.order.findFirst.mockResolvedValueOnce(accessOrder);

        const result = await service.deleteOrderById(99, [Role.CUSTOMER], 1);

        expect(prismaService.client.order.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { status: OrderStatus.CANCELLED },
        });
        expect(eventEmitter.emit).toHaveBeenCalledWith(
            'notification.send',
            expect.objectContaining({
                recipientUserId: 99,
                title: 'Order Cancelled',
            }),
        );
        expect(result).toEqual({
            message: 'Order cancelled successfully',
        });
    });

    it('should reject cancellation after order is delivered', async () => {
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            ...accessOrder,
            status: OrderStatus.DELIVERED,
        });

        await expect(
            service.deleteOrderById(99, [Role.CUSTOMER], 1),
        ).rejects.toThrow(BadRequestException);
    });

    it('should return compatible cancel response', async () => {
        prismaService.client.order.findFirst.mockResolvedValueOnce(accessOrder);

        const result = await service.cancelOrderCompatible(
            99,
            [Role.CUSTOMER],
            1,
        );

        expect(result).toEqual({
            order_id: 1,
            new_status: OrderStatus.CANCELLED,
            status: 'CANCELED',
            status_step: -1,
            message: 'Order cancelled successfully',
        });
    });

    it('should allow business owner to update order status', async () => {
        prismaService.client.order.findFirst.mockResolvedValueOnce(accessOrder);
        prismaService.client.order.update.mockResolvedValueOnce({
            id: 1,
            status: OrderStatus.CONFIRMED,
        });

        const result = await service.updateOrderStatus(55, [Role.BUSINESS], 1, {
            status: OrderStatus.CONFIRMED,
        });

        expect(prismaService.client.order.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { status: OrderStatus.CONFIRMED },
        });
        expect(result).toEqual({
            id: 1,
            status: OrderStatus.CONFIRMED,
        });
    });

    it('should reject customer status update except cancellation', async () => {
        prismaService.client.order.findFirst.mockResolvedValueOnce(accessOrder);

        await expect(
            service.updateOrderStatus(99, [Role.CUSTOMER], 1, {
                status: OrderStatus.CONFIRMED,
            }),
        ).rejects.toThrow(ForbiddenException);
    });
});
