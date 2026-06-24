jest.mock('@prisma/client', () => ({
    OrderStatus: {
        DELIVERED: 'DELIVERED',
    },
    PaymentStatus: {
        DONE: 'DONE',
        UNPAID: 'UNPAID',
    },
    NotificationType: {
        SYSTEM: 'SYSTEM',
    },
    RestaurantApprovalStatus: {
        PENDING: 'PENDING',
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
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

jest.mock('@/utilis/rnadomPassword', () => ({
    generatePassword: jest.fn(() => 'TempPass123'),
}));

import { NotFoundException } from '@nestjs/common';
import { PaymentStatus, RestaurantApprovalStatus } from '@prisma/client';
import { AdminService } from './admin.service';

describe('AdminService', () => {
    let service: AdminService;
    let prismaService: any;
    let auditService: { log: jest.Mock };
    let emailService: { forgotPasswordEmail: jest.Mock };
    let eventEmitter: { emit: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                user: {
                    count: jest.fn(),
                    findFirst: jest.fn(),
                    update: jest.fn(),
                },
                restaurant: {
                    count: jest.fn(),
                    findMany: jest.fn(),
                    findFirst: jest.fn(),
                    update: jest.fn(),
                },
                order: {
                    count: jest.fn(),
                    aggregate: jest.fn(),
                    groupBy: jest.fn(),
                },
                payment: {
                    count: jest.fn(),
                    findMany: jest.fn(),
                    findFirst: jest.fn(),
                    update: jest.fn(),
                },
                category: {
                    count: jest.fn(),
                },
                voucher: {
                    count: jest.fn(),
                },
                auditLog: {
                    findMany: jest.fn(),
                },
            },
        };
        auditService = {
            log: jest.fn(),
        };
        emailService = {
            forgotPasswordEmail: jest.fn(),
        };
        eventEmitter = {
            emit: jest.fn(),
        };
        (globalThis as any).Bun = {
            password: {
                hash: jest.fn().mockResolvedValue('hashed-password'),
            },
        };

        service = new AdminService(
            prismaService,
            auditService as any,
            emailService as any,
            eventEmitter as any,
        );
    });

    it('should return dashboard summary and audit the view', async () => {
        prismaService.client.user.count.mockResolvedValueOnce(10);
        prismaService.client.restaurant.count.mockResolvedValueOnce(4);
        prismaService.client.order.count.mockResolvedValueOnce(30);
        prismaService.client.payment.count.mockResolvedValueOnce(25);
        prismaService.client.category.count.mockResolvedValueOnce(8);
        prismaService.client.voucher.count.mockResolvedValueOnce(3);
        prismaService.client.order.aggregate.mockResolvedValueOnce({
            _sum: { totalPrice: '1234.56' },
        });

        const result = await service.getDashboardSummary(99);

        expect(prismaService.client.order.aggregate).toHaveBeenCalledWith({
            where: {
                status: 'DELIVERED',
            },
            _sum: {
                totalPrice: true,
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'ADMIN_VIEW_DASHBOARD',
            'Dashboard',
            null,
            99,
        );
        expect(result).toEqual({
            users: 10,
            restaurants: 4,
            orders: 30,
            payments: 25,
            categories: 8,
            vouchers: 3,
            deliveredRevenue: 1234.56,
        });
    });

    it('should calculate revenue summary by restaurant and audit the view', async () => {
        prismaService.client.order.aggregate.mockResolvedValueOnce({
            _sum: { totalPrice: '1000' },
        });
        prismaService.client.order.groupBy.mockResolvedValueOnce([
            { restaurantId: 1, _sum: { totalPrice: '700' } },
            { restaurantId: 2, _sum: { totalPrice: '300' } },
        ]);
        prismaService.client.restaurant.findMany.mockResolvedValueOnce([
            { id: 1, name: 'Pizza Shop' },
        ]);

        const result = await service.getRevenueSummary(99);

        expect(prismaService.client.restaurant.findMany).toHaveBeenCalledWith({
            where: {
                id: {
                    in: [1, 2],
                },
            },
            select: {
                id: true,
                name: true,
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'ADMIN_VIEW_REVENUE',
            'Revenue',
            null,
            99,
        );
        expect(result).toEqual({
            grossRevenue: 1000,
            adminCommissionRate: 0.2,
            adminRevenue: 200,
            restaurants: [
                {
                    restaurantId: 1,
                    restaurantName: 'Pizza Shop',
                    grossRevenue: 700,
                    adminRevenue: 140,
                },
                {
                    restaurantId: 2,
                    restaurantName: 'Restaurant #2',
                    grossRevenue: 300,
                    adminRevenue: 60,
                },
            ],
        });
    });

    it('should query audit logs with filters and write an audit log', async () => {
        const logs = [{ id: 1, action: 'ADMIN_VIEW_REVENUE' }];
        prismaService.client.auditLog.findMany.mockResolvedValueOnce(logs);

        const result = await service.getAuditLogs(99, {
            action: 'VIEW',
            entityType: 'Revenue',
            actorId: 7,
            limit: 5,
            offset: 10,
        });

        expect(prismaService.client.auditLog.findMany).toHaveBeenCalledWith({
            where: {
                action: {
                    contains: 'VIEW',
                    mode: 'insensitive',
                },
                entityType: {
                    contains: 'Revenue',
                    mode: 'insensitive',
                },
                actorId: 7,
            },
            include: {
                actor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 5,
            skip: 10,
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'ADMIN_READ_AUDIT_LOG',
            'AuditLog',
            null,
            99,
            {
                filters: {
                    action: 'VIEW',
                    entityType: 'Revenue',
                    actorId: 7,
                },
            },
        );
        expect(result).toEqual(logs);
    });

    it('should map payment amounts to numbers and audit payment views', async () => {
        prismaService.client.payment.findMany.mockResolvedValueOnce([
            {
                id: 1,
                amount: '45.5',
                order: {
                    id: 10,
                    totalPrice: '50.25',
                },
            },
        ]);

        const result = await service.getPayments(99, {
            paymentStatus: PaymentStatus.DONE,
            method: 'CASH' as any,
            userId: 2,
            restaurantId: 3,
            limit: 5,
            offset: 10,
        });

        expect(prismaService.client.payment.findMany).toHaveBeenCalledWith({
            where: {
                paymentStatus: PaymentStatus.DONE,
                method: 'CASH',
                order: {
                    userId: 2,
                    restaurantId: 3,
                },
            },
            select: {
                id: true,
                orderId: true,
                amount: true,
                method: true,
                paymentStatus: true,
                createdAt: true,
                updatedAt: true,
                order: {
                    select: {
                        id: true,
                        status: true,
                        totalPrice: true,
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                            },
                        },
                        restaurant: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 5,
            skip: 10,
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'ADMIN_VIEW_PAYMENTS',
            'Payment',
            null,
            99,
            {
                filters: {
                    paymentStatus: PaymentStatus.DONE,
                    method: 'CASH',
                    userId: 2,
                    restaurantId: 3,
                    limit: 5,
                    offset: 10,
                },
            },
        );
        expect(result).toEqual([
            {
                id: 1,
                amount: 45.5,
                order: {
                    id: 10,
                    totalPrice: 50.25,
                },
            },
        ]);
    });

    it('should throw NotFoundException when updating a missing payment', async () => {
        prismaService.client.payment.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.updatePaymentStatus(99, 404, PaymentStatus.DONE),
        ).rejects.toThrow(NotFoundException);
    });

    it('should update payment status and write an audit log', async () => {
        const payment = {
            id: 1,
            orderId: 10,
            paymentStatus: PaymentStatus.UNPAID,
        };
        const updatedPayment = {
            ...payment,
            paymentStatus: PaymentStatus.DONE,
        };
        prismaService.client.payment.findFirst.mockResolvedValueOnce(payment);
        prismaService.client.payment.update.mockResolvedValueOnce(updatedPayment);

        const result = await service.updatePaymentStatus(
            99,
            1,
            PaymentStatus.DONE,
        );

        expect(prismaService.client.payment.update).toHaveBeenCalledWith({
            where: {
                id: 1,
            },
            data: {
                paymentStatus: PaymentStatus.DONE,
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'ADMIN_UPDATE_PAYMENT_STATUS',
            'Payment',
            1,
            99,
            {
                orderId: 10,
                previousStatus: PaymentStatus.UNPAID,
                nextStatus: PaymentStatus.DONE,
            },
        );
        expect(result).toEqual(updatedPayment);
    });

    it('should throw NotFoundException when resetting password for a missing user', async () => {
        prismaService.client.user.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.resetUserPassword(99, 404, { sendEmail: true }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should reset user password, send email when requested, and audit the action', async () => {
        prismaService.client.user.findFirst.mockResolvedValueOnce({
            id: 2,
            email: 'user@example.com',
            name: 'User',
        });
        prismaService.client.user.update.mockResolvedValueOnce({ id: 2 });
        emailService.forgotPasswordEmail.mockResolvedValueOnce(undefined);

        const result = await service.resetUserPassword(99, 2, {
            sendEmail: true,
        });

        expect((globalThis as any).Bun.password.hash).toHaveBeenCalledWith(
            'TempPass123',
            {
                cost: 10,
                algorithm: 'bcrypt',
            },
        );
        expect(prismaService.client.user.update).toHaveBeenCalledWith({
            where: {
                id: 2,
            },
            data: {
                password: 'hashed-password',
            },
        });
        expect(emailService.forgotPasswordEmail).toHaveBeenCalledWith(
            '[BETA DELIVERY] ADMIN RESET YOUR PASSWORD',
            'user@example.com',
            'TempPass123',
        );
        expect(auditService.log).toHaveBeenCalledWith(
            'ADMIN_RESET_USER_PASSWORD',
            'User',
            2,
            99,
            {
                sentEmail: true,
            },
        );
        expect(result).toEqual({
            userId: 2,
            email: 'user@example.com',
            temporaryPassword: 'TempPass123',
            emailSent: true,
        });
    });

    it('should reset user password without sending email when not requested', async () => {
        prismaService.client.user.findFirst.mockResolvedValueOnce({
            id: 2,
            email: 'user@example.com',
            name: 'User',
        });
        prismaService.client.user.update.mockResolvedValueOnce({ id: 2 });

        const result = await service.resetUserPassword(99, 2, {
            sendEmail: false,
        });

        expect(emailService.forgotPasswordEmail).not.toHaveBeenCalled();
        expect(result.emailSent).toBe(false);
    });

    it('should throw NotFoundException when updating approval for a missing restaurant', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.updateRestaurantApproval(
                99,
                404,
                RestaurantApprovalStatus.APPROVED,
            ),
        ).rejects.toThrow(NotFoundException);
    });

    it('should update restaurant approval, emit notification, and audit the action', async () => {
        const restaurant = {
            id: 5,
            status: RestaurantApprovalStatus.PENDING,
            name: 'Pizza Shop',
            ownerId: 8,
        };
        const updatedRestaurant = {
            ...restaurant,
            status: RestaurantApprovalStatus.APPROVED,
        };
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce(restaurant);
        prismaService.client.restaurant.update.mockResolvedValueOnce(updatedRestaurant);

        const result = await service.updateRestaurantApproval(
            99,
            5,
            RestaurantApprovalStatus.APPROVED,
        );

        expect(prismaService.client.restaurant.update).toHaveBeenCalledWith({
            where: {
                id: 5,
            },
            data: {
                status: RestaurantApprovalStatus.APPROVED,
            },
        });
        expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', {
            recipientUserId: 8,
            title: 'Restaurant Approval Status Update',
            body: 'Your restaurant "Pizza Shop" has been approved by the administrator.',
            type: 'SYSTEM',
            targetType: 'RESTAURANT',
            targetId: 5,
            actorId: 99,
            metadata: {
                restaurantId: 5,
                status: RestaurantApprovalStatus.APPROVED,
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'ADMIN_UPDATE_RESTAURANT_APPROVAL',
            'Restaurant',
            5,
            99,
            {
                previousStatus: RestaurantApprovalStatus.PENDING,
                nextStatus: RestaurantApprovalStatus.APPROVED,
            },
        );
        expect(result).toEqual(updatedRestaurant);
    });

    it('should still audit approval changes when notification emit fails', async () => {
        const restaurant = {
            id: 5,
            status: RestaurantApprovalStatus.APPROVED,
            name: 'Pizza Shop',
            ownerId: 8,
        };
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce(restaurant);
        prismaService.client.restaurant.update.mockResolvedValueOnce({
            ...restaurant,
            status: RestaurantApprovalStatus.REJECTED,
        });
        eventEmitter.emit.mockImplementationOnce(() => {
            throw new Error('emit failed');
        });
        jest.spyOn(console, 'error').mockImplementationOnce(() => undefined);

        const result = await service.updateRestaurantApproval(
            99,
            5,
            RestaurantApprovalStatus.REJECTED,
        );

        expect(auditService.log).toHaveBeenCalledWith(
            'ADMIN_UPDATE_RESTAURANT_APPROVAL',
            'Restaurant',
            5,
            99,
            {
                previousStatus: RestaurantApprovalStatus.APPROVED,
                nextStatus: RestaurantApprovalStatus.REJECTED,
            },
        );
        expect(result).toEqual({
            ...restaurant,
            status: RestaurantApprovalStatus.REJECTED,
        });
    });
});
