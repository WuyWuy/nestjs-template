jest.mock('@prisma/client', () => ({
    Role: {
        ADMIN: 'ADMIN',
        BUSINESS: 'BUSINESS',
    },
    PaymentMethod: {
        CASH: 'CASH',
        MOMO: 'MOMO',
    },
    PaymentStatus: {
        UNPAID: 'UNPAID',
        DONE: 'DONE',
        FAILED: 'FAILED',
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

import { PaymentStatus, Role } from '@prisma/client';
import { PaymentController } from './payment.controller';

describe('PaymentController', () => {
    let controller: PaymentController;
    let paymentService: {
        updateMoMoPaymentStatus: jest.Mock;
        getPaymentDetail: jest.Mock;
        confirmPayment: jest.Mock;
    };

    beforeEach(() => {
        paymentService = {
            updateMoMoPaymentStatus: jest.fn(),
            getPaymentDetail: jest.fn(),
            confirmPayment: jest.fn(),
        };

        controller = new PaymentController(paymentService as any);
    });

    it('should update momo payment status from webhook body', async () => {
        const body = {
            momoOrderId: 'partner-10',
            status: PaymentStatus.DONE,
        };
        paymentService.updateMoMoPaymentStatus.mockResolvedValueOnce({
            id: 1,
            paymentStatus: PaymentStatus.DONE,
        });

        const result = await controller.checkPayment(body);

        expect(paymentService.updateMoMoPaymentStatus).toHaveBeenCalledWith(
            'partner-10',
            PaymentStatus.DONE,
        );
        expect(result).toEqual({
            id: 1,
            paymentStatus: PaymentStatus.DONE,
        });
    });

    it('should get payment detail by order id', async () => {
        paymentService.getPaymentDetail.mockResolvedValueOnce({
            id: 1,
            orderId: 10,
        });

        const result = await controller.getPaymentDetail(10);

        expect(paymentService.getPaymentDetail).toHaveBeenCalledWith(10);
        expect(result).toEqual({
            id: 1,
            orderId: 10,
        });
    });

    it('should confirm payment with authenticated user roles', async () => {
        paymentService.confirmPayment.mockResolvedValueOnce({
            id: 5,
            paymentStatus: PaymentStatus.DONE,
        });

        const result = await controller.confirmPayment(5, {
            user: { id: 55, roles: [Role.BUSINESS] },
        } as any);

        expect(paymentService.confirmPayment).toHaveBeenCalledWith(
            5,
            55,
            [Role.BUSINESS],
        );
        expect(result).toEqual({
            id: 5,
            paymentStatus: PaymentStatus.DONE,
        });
    });

    it('should fall back to empty roles when confirming payment', async () => {
        paymentService.confirmPayment.mockResolvedValueOnce({
            id: 5,
        });

        await controller.confirmPayment(5, {
            user: { id: 55 },
        } as any);

        expect(paymentService.confirmPayment).toHaveBeenCalledWith(5, 55, []);
    });
});
