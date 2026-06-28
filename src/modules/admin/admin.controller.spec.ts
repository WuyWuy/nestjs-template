jest.mock('@prisma/client', () => ({
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
    Role: {
        ADMIN: 'ADMIN',
    },
    RestaurantApprovalStatus: {
        PENDING: 'PENDING',
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
    },
    PaymentStatus: {
        DONE: 'DONE',
        UNPAID: 'UNPAID',
    },
    PaymentMethod: {
        CASH: 'CASH',
        MOMO: 'MOMO',
        ZALOPAY: 'ZALOPAY',
    },
}));

import { PaymentStatus, RestaurantApprovalStatus } from '@prisma/client';
import { AdminController } from './admin.controller';

describe('AdminController', () => {
    let controller: AdminController;
    let adminService: {
        getDashboardSummary: jest.Mock;
        getRevenueSummary: jest.Mock;
        getRevenueDetails: jest.Mock;
        getUsers: jest.Mock;
        updateUserBlockStatus: jest.Mock;
        updateRestaurantActiveStatus: jest.Mock;
        getAuditLogs: jest.Mock;
        getPayments: jest.Mock;
        updatePaymentStatus: jest.Mock;
        resetUserPassword: jest.Mock;
        updateRestaurantApproval: jest.Mock;
    };

    beforeEach(() => {
        adminService = {
            getDashboardSummary: jest.fn(),
            getRevenueSummary: jest.fn(),
            getRevenueDetails: jest.fn(),
            getUsers: jest.fn(),
            updateUserBlockStatus: jest.fn(),
            updateRestaurantActiveStatus: jest.fn(),
            getAuditLogs: jest.fn(),
            getPayments: jest.fn(),
            updatePaymentStatus: jest.fn(),
            resetUserPassword: jest.fn(),
            updateRestaurantApproval: jest.fn(),
        };

        controller = new AdminController(adminService as any);
    });

    it('should forward revenue detail requests with pagination filters', async () => {
        const query = { limit: 10, offset: 0 };
        adminService.getRevenueDetails.mockResolvedValue({
            success: true,
            data: [],
            total: 0,
            limit: 10,
            offset: 0,
        });

        await controller.getRevenueDetails(
            { user: { id: 99 } } as any,
            query,
        );

        expect(adminService.getRevenueDetails).toHaveBeenCalledWith(99, query);
    });

    it('should forward user list and block requests', async () => {
        const query = { role: 'CUSTOMER' as any, keyword: 'customer' };
        adminService.getUsers.mockResolvedValue({ success: true, data: [] });
        adminService.updateUserBlockStatus.mockResolvedValue({
            success: true,
        });

        await controller.getUsers({ user: { id: 99 } } as any, query);
        await controller.updateUserBlockStatus(
            { user: { id: 99 } } as any,
            2,
            { isBlocked: true, reason: 'Fraud review' },
        );

        expect(adminService.getUsers).toHaveBeenCalledWith(99, query);
        expect(adminService.updateUserBlockStatus).toHaveBeenCalledWith(
            99,
            2,
            { isBlocked: true, reason: 'Fraud review' },
        );
    });

    it('should forward restaurant active status updates', async () => {
        adminService.updateRestaurantActiveStatus.mockResolvedValue({
            success: true,
        });

        await controller.updateRestaurantActiveStatus(
            { user: { id: 99 } } as any,
            5,
            { isActive: false },
        );

        expect(adminService.updateRestaurantActiveStatus).toHaveBeenCalledWith(
            99,
            5,
            false,
        );
    });

    it('should forward dashboard requests with actor id', async () => {
        adminService.getDashboardSummary.mockResolvedValue({ users: 1 });

        const result = await controller.getDashboard({ user: { id: 99 } } as any);

        expect(result).toEqual({ users: 1 });
        expect(adminService.getDashboardSummary).toHaveBeenCalledWith(99);
    });

    it('should forward revenue requests with actor id', async () => {
        adminService.getRevenueSummary.mockResolvedValue({ grossRevenue: 100 });

        const result = await controller.getRevenue({ user: { id: 99 } } as any);

        expect(result).toEqual({ grossRevenue: 100 });
        expect(adminService.getRevenueSummary).toHaveBeenCalledWith(99);
    });

    it('should forward audit log requests with actor id and query', async () => {
        const query = { action: 'VIEW', limit: 5, offset: 0 };
        adminService.getAuditLogs.mockResolvedValue([{ id: 1 }]);

        const result = await controller.getAuditLogs(
            { user: { id: 99 } } as any,
            query,
        );

        expect(result).toEqual([{ id: 1 }]);
        expect(adminService.getAuditLogs).toHaveBeenCalledWith(99, query);
    });

    it('should forward payment list requests with actor id and query', async () => {
        const query = { paymentStatus: PaymentStatus.DONE, limit: 10 };
        adminService.getPayments.mockResolvedValue([{ id: 1 }]);

        const result = await controller.getPayments(
            { user: { id: 99 } } as any,
            query,
        );

        expect(result).toEqual([{ id: 1 }]);
        expect(adminService.getPayments).toHaveBeenCalledWith(99, query);
    });

    it('should forward payment status updates with actor id and payment status', async () => {
        adminService.updatePaymentStatus.mockResolvedValue({
            id: 7,
            paymentStatus: PaymentStatus.DONE,
        });

        const result = await controller.updatePaymentStatus(
            { user: { id: 99 } } as any,
            7,
            { paymentStatus: PaymentStatus.DONE },
        );

        expect(result).toEqual({
            id: 7,
            paymentStatus: PaymentStatus.DONE,
        });
        expect(adminService.updatePaymentStatus).toHaveBeenCalledWith(
            99,
            7,
            PaymentStatus.DONE,
        );
    });

    it('should forward password reset requests with actor id and body', async () => {
        const body = { sendEmail: true };
        adminService.resetUserPassword.mockResolvedValue({
            userId: 2,
            emailSent: true,
        });

        const result = await controller.resetUserPassword(
            { user: { id: 99 } } as any,
            2,
            body,
        );

        expect(result).toEqual({
            userId: 2,
            emailSent: true,
        });
        expect(adminService.resetUserPassword).toHaveBeenCalledWith(99, 2, body);
    });

    it('should forward restaurant approval requests with actor id and body', async () => {
        adminService.updateRestaurantApproval.mockResolvedValue({
            id: 5,
            status: RestaurantApprovalStatus.APPROVED,
        });

        const result = await controller.updateRestaurantApproval(
            { user: { id: 99 } } as any,
            5,
            { status: RestaurantApprovalStatus.APPROVED },
        );

        expect(result).toEqual({
            id: 5,
            status: RestaurantApprovalStatus.APPROVED,
        });
        expect(adminService.updateRestaurantApproval).toHaveBeenCalledWith(
            99,
            5,
            RestaurantApprovalStatus.APPROVED,
        );
    });
});
