jest.mock('@prisma/client', () => {
    class MockDecimal {
        constructor(private readonly value: number | string) {}

        plus(other: MockDecimal | number) {
            return new MockDecimal(Number(this.value) + Number(other));
        }

        mul(other: number) {
            return new MockDecimal(Number(this.value) * other);
        }

        valueOf() {
            return Number(this.value);
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

import { OrderStatus, PaymentMethod, Role } from '@prisma/client';
import { OrderController } from './order.controller';

describe('OrderController', () => {
    let controller: OrderController;
    let orderService: {
        createOrder: jest.Mock;
        reorder: jest.Mock;
        getAllOrders: jest.Mock;
        getOrderDetail: jest.Mock;
        getOrderStatus: jest.Mock;
        deleteOrderById: jest.Mock;
        cancelOrderCompatible: jest.Mock;
        updateOrderStatus: jest.Mock;
    };

    beforeEach(() => {
        orderService = {
            createOrder: jest.fn(),
            reorder: jest.fn(),
            getAllOrders: jest.fn(),
            getOrderDetail: jest.fn(),
            getOrderStatus: jest.fn(),
            deleteOrderById: jest.fn(),
            cancelOrderCompatible: jest.fn(),
            updateOrderStatus: jest.fn(),
        };

        controller = new OrderController(orderService as any);
    });

    it('should create order for authenticated customer', async () => {
        const body = {
            restaurantId: 7,
            savedAddressId: 2,
            orderFoods: [{ foodId: 3, quantity: 1, fullText: '' }],
            paymentMethod: PaymentMethod.CASH,
        };
        orderService.createOrder.mockResolvedValueOnce({ id: 1 });

        const result = await controller.createOrder(body, {
            user: { id: 99 },
        } as any);

        expect(orderService.createOrder).toHaveBeenCalledWith(99, body);
        expect(result).toEqual({ id: 1 });
    });

    it('should reorder previous order for authenticated user', async () => {
        orderService.reorder.mockResolvedValueOnce({ cartId: 5 });

        const result = await controller.reorder(10, {
            user: { id: 99 },
        } as any);

        expect(orderService.reorder).toHaveBeenCalledWith(99, 10);
        expect(result).toEqual({ cartId: 5 });
    });

    it('should get all orders with query defaults', async () => {
        orderService.getAllOrders.mockResolvedValueOnce([{ id: 1 }]);

        const result = await controller.getAllOrders(
            { user: { id: 99, roles: [Role.CUSTOMER] } } as any,
            {},
        );

        expect(orderService.getAllOrders).toHaveBeenCalledWith(
            99,
            [Role.CUSTOMER],
            20,
            0,
            undefined,
        );
        expect(result).toEqual([{ id: 1 }]);
    });

    it('should get all orders with provided query values', async () => {
        const query = { limit: 5, offset: 10, status: 'history' };
        orderService.getAllOrders.mockResolvedValueOnce({
            history_orders: [],
        });

        const result = await controller.getAllOrders(
            { user: { id: 55, roles: [Role.BUSINESS] } } as any,
            query,
        );

        expect(orderService.getAllOrders).toHaveBeenCalledWith(
            55,
            [Role.BUSINESS],
            5,
            10,
            'history',
        );
        expect(result).toEqual({ history_orders: [] });
    });

    it('should get order detail for requester', async () => {
        orderService.getOrderDetail.mockResolvedValueOnce({ id: 1 });

        const result = await controller.getOrderDetail(1, {
            user: { id: 99, roles: [Role.CUSTOMER] },
        } as any);

        expect(orderService.getOrderDetail).toHaveBeenCalledWith(
            99,
            [Role.CUSTOMER],
            1,
        );
        expect(result).toEqual({ id: 1 });
    });

    it('should get order status for requester', async () => {
        orderService.getOrderStatus.mockResolvedValueOnce({
            order_id: 1,
            status: 'RECEIVED',
        });

        const result = await controller.getOrderStatus(1, {
            user: { id: 99, roles: [Role.CUSTOMER] },
        } as any);

        expect(orderService.getOrderStatus).toHaveBeenCalledWith(
            99,
            [Role.CUSTOMER],
            1,
        );
        expect(result).toEqual({
            order_id: 1,
            status: 'RECEIVED',
        });
    });

    it('should cancel order by delete endpoint', async () => {
        orderService.deleteOrderById.mockResolvedValueOnce({
            message: 'Order cancelled successfully',
        });

        const result = await controller.cancelOrder(1, {
            user: { id: 99, roles: [Role.CUSTOMER] },
        } as any);

        expect(orderService.deleteOrderById).toHaveBeenCalledWith(
            99,
            [Role.CUSTOMER],
            1,
        );
        expect(result).toEqual({
            message: 'Order cancelled successfully',
        });
    });

    it('should cancel order by compatible endpoint', async () => {
        orderService.cancelOrderCompatible.mockResolvedValueOnce({
            order_id: 1,
        });

        const result = await controller.cancelOrderCompatible(1, {
            user: { id: 99, roles: [Role.CUSTOMER] },
        } as any);

        expect(orderService.cancelOrderCompatible).toHaveBeenCalledWith(
            99,
            [Role.CUSTOMER],
            1,
        );
        expect(result).toEqual({ order_id: 1 });
    });

    it('should update order status for requester', async () => {
        const body = { status: OrderStatus.CONFIRMED };
        orderService.updateOrderStatus.mockResolvedValueOnce({
            id: 1,
            status: OrderStatus.CONFIRMED,
        });

        const result = await controller.updateOrderStatus(
            1,
            { user: { id: 55, roles: [Role.BUSINESS] } } as any,
            body,
        );

        expect(orderService.updateOrderStatus).toHaveBeenCalledWith(
            55,
            [Role.BUSINESS],
            1,
            body,
        );
        expect(result).toEqual({
            id: 1,
            status: OrderStatus.CONFIRMED,
        });
    });

    it('should fall back to empty roles when request user has none', async () => {
        orderService.getOrderStatus.mockResolvedValueOnce({
            order_id: 1,
        });

        await controller.getOrderStatus(1, { user: { id: 99 } } as any);

        expect(orderService.getOrderStatus).toHaveBeenCalledWith(99, [], 1);
    });
});
