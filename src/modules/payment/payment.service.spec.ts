jest.mock('@prisma/client', () => {
    class MockDecimal {
        constructor(private readonly value: number | string) {}

        valueOf() {
            return Number(this.value);
        }

        toString() {
            return String(this.value);
        }
    }

    return {
        OrderStatus: {
            PENDING: 'PENDING',
            CONFIRMED: 'CONFIRMED',
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
        Role: {
            ADMIN: 'ADMIN',
            BUSINESS: 'BUSINESS',
        },
        NotificationType: {
            ORDER: 'ORDER',
            PAYMENT: 'PAYMENT',
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

jest.mock('./payment.utls', () => ({
    getMomoPayUrl: jest.fn(),
}));

import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import {
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Prisma,
    Role,
} from '@prisma/client';
import { getMomoPayUrl } from './payment.utls';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
    let service: PaymentService;
    let configService: { get: jest.Mock };
    let prismaService: any;
    let auditService: { log: jest.Mock };
    let eventEmitter: { emit: jest.Mock };
    let tx: any;

    const decimal = (value: number) => new Prisma.Decimal(value);

    const buildService = (config: Record<string, string | undefined> = {}) => {
        configService = {
            get: jest.fn((key: string) => config[key]),
        };

        service = new PaymentService(
            configService as any,
            prismaService,
            auditService as any,
            eventEmitter as any,
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();

        tx = {
            payment: {
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            order: {
                findFirst: jest.fn(),
                update: jest.fn(),
            },
        };

        prismaService = {
            client: {
                payment: {
                    findFirst: jest.fn(),
                    findUnique: jest.fn(),
                    update: jest.fn(),
                },
                order: {
                    findFirst: jest.fn(),
                    update: jest.fn(),
                },
                restaurant: {
                    findFirst: jest.fn(),
                },
                $transaction: jest.fn((callback) => callback(tx)),
            },
        };
        auditService = {
            log: jest.fn(),
        };
        eventEmitter = {
            emit: jest.fn(),
        };

        buildService();
    });

    it('should create payment snapshot when order has no payment yet', async () => {
        tx.payment.findFirst.mockResolvedValueOnce(null);
        tx.payment.create.mockResolvedValueOnce({
            id: 1,
            orderId: 10,
            amount: decimal(50),
            method: PaymentMethod.CASH,
            paymentStatus: PaymentStatus.UNPAID,
        });

        const result = await service.createPaymentSnapshot(
            10,
            PaymentMethod.CASH,
            decimal(50),
            tx,
        );

        expect(tx.payment.create).toHaveBeenCalledWith({
            data: {
                orderId: 10,
                amount: decimal(50),
                method: PaymentMethod.CASH,
                paymentStatus: PaymentStatus.UNPAID,
            },
        });
        expect(result).toEqual({
            id: 1,
            orderId: 10,
            amount: decimal(50),
            method: PaymentMethod.CASH,
            paymentStatus: PaymentStatus.UNPAID,
        });
    });

    it('should reject duplicate payment snapshot for one order', async () => {
        tx.payment.findFirst.mockResolvedValueOnce({ id: 1 });

        await expect(
            service.createPaymentSnapshot(10, PaymentMethod.CASH, 50, tx),
        ).rejects.toThrow(BadRequestException);
    });

    it('should create cash payment for an existing order', async () => {
        tx.order.findFirst.mockResolvedValueOnce({ id: 10 });
        tx.payment.findFirst.mockResolvedValueOnce(null);
        tx.payment.create.mockResolvedValueOnce({
            id: 2,
            orderId: 10,
            method: PaymentMethod.CASH,
            amount: decimal(60),
            paymentStatus: PaymentStatus.UNPAID,
        });

        const result = await service.createCashPayment(10, decimal(60), tx);

        expect(tx.order.findFirst).toHaveBeenCalledWith({
            where: { id: 10 },
        });
        expect(result).toEqual({
            id: 2,
            orderId: 10,
            method: PaymentMethod.CASH,
            amount: decimal(60),
            paymentStatus: PaymentStatus.UNPAID,
        });
    });

    it('should throw NotFoundException when creating cash payment without order', async () => {
        tx.order.findFirst.mockResolvedValueOnce(null);

        await expect(service.createCashPayment(404, 60, tx)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should create mock momo payment when credentials are missing', async () => {
        tx.order.findFirst.mockResolvedValueOnce({ id: 10 });
        tx.payment.findFirst.mockResolvedValueOnce(null);
        tx.payment.create.mockResolvedValueOnce({ id: 3 });

        const result = await service.createMoMoPayment(10, 80, tx);

        expect(result).toEqual(
            expect.objectContaining({
                partnerCode: 'MOMO',
                orderId: 'mock-10',
                payUrl: expect.stringContaining('orderId=10&amount=80'),
                resultCode: 0,
            }),
        );
        expect(getMomoPayUrl).not.toHaveBeenCalled();
    });

    it('should call momo helper when credentials are configured', async () => {
        buildService({
            MOMO_ACCESS_KEY: 'access',
            MOMO_SECRET_KEY: 'secret',
            MOMO_PARTNER_CODE: 'partner',
        });
        tx.order.findFirst.mockResolvedValueOnce({ id: 10 });
        tx.payment.findFirst.mockResolvedValueOnce(null);
        tx.payment.create.mockResolvedValueOnce({ id: 3 });
        (getMomoPayUrl as jest.Mock).mockResolvedValueOnce({
            payUrl: 'https://momo.test/pay',
        });

        const result = await service.createMoMoPayment(10, 80, tx);

        expect(getMomoPayUrl).toHaveBeenCalledWith(
            'partner',
            'access',
            'secret',
            80,
            10,
        );
        expect(result).toEqual({ payUrl: 'https://momo.test/pay' });
    });

    it('should fall back to mock momo payment when helper throws', async () => {
        buildService({
            MOMO_ACCESS_KEY: 'access',
            MOMO_SECRET_KEY: 'secret',
            MOMO_PARTNER_CODE: 'partner',
        });
        tx.order.findFirst.mockResolvedValueOnce({ id: 10 });
        tx.payment.findFirst.mockResolvedValueOnce(null);
        tx.payment.create.mockResolvedValueOnce({ id: 3 });
        (getMomoPayUrl as jest.Mock).mockRejectedValueOnce(new Error('network'));

        const result = await service.createMoMoPayment(10, 80, tx);

        expect(result).toEqual(
            expect.objectContaining({
                partnerCode: 'partner',
                orderId: 'mock-10',
                resultCode: 0,
            }),
        );
    });

    it('should update momo payment status without changing order status', async () => {
        prismaService.client.payment.findFirst.mockResolvedValueOnce({
            id: 5,
            orderId: 10,
        });
        prismaService.client.payment.update.mockResolvedValueOnce({
            id: 5,
            paymentStatus: PaymentStatus.DONE,
        });

        const result = await service.updateMoMoPaymentStatus(
            'partner-10',
            PaymentStatus.DONE,
        );

        expect(prismaService.client.payment.update).toHaveBeenCalledWith({
            where: { id: 5 },
            data: { paymentStatus: PaymentStatus.DONE },
        });
        expect(prismaService.client.order.update).not.toHaveBeenCalled();
        expect(result).toEqual({
            id: 5,
            paymentStatus: PaymentStatus.DONE,
        });
    });

    it('should reject momo status update when order id format is invalid', async () => {
        await expect(
            service.updateMoMoPaymentStatus('bad-format', PaymentStatus.DONE),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when momo payment is missing', async () => {
        prismaService.client.payment.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.updateMoMoPaymentStatus('10', PaymentStatus.DONE),
        ).rejects.toThrow(NotFoundException);
    });

    it('should update checking payment status', async () => {
        prismaService.client.payment.findFirst.mockResolvedValueOnce({
            id: 5,
        });
        prismaService.client.payment.update.mockResolvedValueOnce({
            id: 5,
            paymentStatus: PaymentStatus.FAILED,
        });

        const result = await service.checkingPayment(
            10,
            PaymentStatus.FAILED,
        );

        expect(prismaService.client.payment.update).toHaveBeenCalledWith({
            where: { id: 5 },
            data: { paymentStatus: PaymentStatus.FAILED },
        });
        expect(result).toEqual({
            id: 5,
            paymentStatus: PaymentStatus.FAILED,
        });
    });

    it('should return payment detail with numeric amount', async () => {
        const createdAt = new Date('2025-01-01T00:00:00.000Z');
        prismaService.client.payment.findFirst.mockResolvedValueOnce({
            id: 5,
            orderId: 10,
            amount: decimal(99),
            method: PaymentMethod.CASH,
            paymentStatus: PaymentStatus.UNPAID,
            createdAt,
        });

        const result = await service.getPaymentDetail(10);

        expect(result).toEqual({
            id: 5,
            orderId: 10,
            amount: 99,
            method: PaymentMethod.CASH,
            paymentStatus: PaymentStatus.UNPAID,
            createdAt,
        });
    });

    it('should throw NotFoundException when payment detail is missing', async () => {
        prismaService.client.payment.findFirst.mockResolvedValueOnce(null);

        await expect(service.getPaymentDetail(10)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should confirm payment for restaurant owner and emit notifications', async () => {
        prismaService.client.payment.findUnique.mockResolvedValueOnce({
            id: 5,
            amount: decimal(120),
            order: {
                id: 10,
                restaurantId: 7,
                status: OrderStatus.PENDING,
                userId: 99,
            },
        });
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 7,
            ownerId: 55,
        });
        tx.payment.update.mockResolvedValueOnce({
            id: 5,
            amount: decimal(120),
            paymentStatus: PaymentStatus.DONE,
        });

        const result = await service.confirmPayment(5, 55, [Role.BUSINESS]);

        expect(tx.payment.update).toHaveBeenCalledWith({
            where: { id: 5 },
            data: { paymentStatus: PaymentStatus.DONE },
        });
        expect(tx.order.update).not.toHaveBeenCalled();
        expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
        expect(auditService.log).toHaveBeenCalledWith(
            'CONFIRM_PAYMENT',
            'Payment',
            5,
            55,
            { amount: 120 },
        );
        expect(result).toEqual({
            id: 5,
            amount: 120,
            paymentStatus: PaymentStatus.DONE,
        });
    });

    it('should allow admin to confirm payment for any restaurant', async () => {
        prismaService.client.payment.findUnique.mockResolvedValueOnce({
            id: 5,
            amount: decimal(120),
            order: {
                id: 10,
                restaurantId: 7,
                status: OrderStatus.CONFIRMED,
                userId: 99,
            },
        });
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 7,
            ownerId: 55,
        });
        tx.payment.update.mockResolvedValueOnce({
            id: 5,
            amount: decimal(120),
            paymentStatus: PaymentStatus.DONE,
        });

        const result = await service.confirmPayment(5, 1, [Role.ADMIN]);

        expect(tx.order.update).not.toHaveBeenCalled();
        expect(result.amount).toBe(120);
    });

    it('should reject confirm payment for non-owner business', async () => {
        prismaService.client.payment.findUnique.mockResolvedValueOnce({
            id: 5,
            amount: decimal(120),
            order: {
                id: 10,
                restaurantId: 7,
                status: OrderStatus.PENDING,
                userId: 99,
            },
        });
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 7,
            ownerId: 55,
        });

        await expect(
            service.confirmPayment(5, 66, [Role.BUSINESS]),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when confirming missing payment', async () => {
        prismaService.client.payment.findUnique.mockResolvedValueOnce(null);

        await expect(
            service.confirmPayment(404, 55, [Role.BUSINESS]),
        ).rejects.toThrow(NotFoundException);
    });
});
