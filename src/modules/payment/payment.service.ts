import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    Prisma,
} from '@prisma/client';
import { getMomoPayUrl } from './payment.utls';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionClientExtended } from '@/prisma/custom-prisma-client';

@Injectable()
export class PaymentService {
    private readonly momoAccessKey?: string;
    private readonly momoSecretKey?: string;
    private readonly momoPartnerCode?: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly prismaService: PrismaService,
    ) {
        this.momoAccessKey =
            this.configService.get<string>('MOMO_ACCESS_KEY') || undefined;
        this.momoSecretKey =
            this.configService.get<string>('MOMO_SECRET_KEY') || undefined;
        this.momoPartnerCode =
            this.configService.get<string>('MOMO_PARTNER_CODE') || undefined;
    }

    private async getPaymentByOrderId(orderId: number) {
        const payment = await this.prismaService.client.payment.findFirst({
            where: {
                orderId,
            },
            select: {
                id: true,
                orderId: true,
                amount: true,
                method: true,
                paymentStatus: true,
                createdAt: true,
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        return {
            ...payment,
            amount: Number(payment.amount),
        };
    }

    private buildMockMoMoResponse(orderId: number, money: number) {
        return {
            partnerCode: this.momoPartnerCode ?? 'MOMO',
            orderId: `mock-${orderId}`,
            requestId: `mock-${Date.now()}`,
            payUrl: `https://sandbox.momo.vn/mock-pay?orderId=${orderId}&amount=${money}`,
            deeplink: '',
            qrCodeUrl: '',
            resultCode: 0,
            message:
                'Mock MoMo payment created because credentials or network are unavailable',
        };
    }

    async createPaymentSnapshot(
        orderId: number,
        method: PaymentMethod,
        money: number | Prisma.Decimal,
        tx: PrismaService | TransactionClientExtended = this.prismaService,
    ) {
        const existingPayment = await tx.payment.findFirst({
            where: { orderId },
        });
        if (existingPayment) {
            throw new BadRequestException(
                `Payment already exists for order ${orderId}. One order can only be paid once.`,
            );
        }

        return await tx.payment.create({
            data: {
                orderId,
                amount: money,
                method,
                paymentStatus: PaymentStatus.UNPAID,
            },
        });
    }

    async updateMoMoPaymentStatus(momoOrderId: string, status: PaymentStatus) {
        let orderId = momoOrderId;
        if (momoOrderId.includes('-')) orderId = momoOrderId.split('-').pop()!;
        if (!orderId || isNaN(Number(orderId))) {
            throw new BadRequestException('Order ID in invalid format');
        }

        const payment = await this.prismaService.client.payment.findFirst({
            where: {
                orderId: Number(orderId),
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        const result = await this.prismaService.client.payment.update({
            where: {
                id: payment.id,
            },
            data: {
                paymentStatus: status,
            },
        });

        if (status === PaymentStatus.DONE) {
            const order = await this.prismaService.client.order.findFirst({
                where: {
                    id: Number(orderId),
                },
            });

            if (order && order.status === 'PENDING') {
                await this.prismaService.client.order.update({
                    where: {
                        id: order.id,
                    },
                    data: {
                        status: OrderStatus.CONFIRMED,
                    },
                });
            }
        }

        return result;
    }

    async createMoMoPayment(
        orderId: number,
        money: number | Prisma.Decimal,
        tx: TransactionClientExtended | PrismaService = this.prismaService,
    ) {
        const order = await tx.order.findFirst({
            where: {
                id: orderId,
            },
        });
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        await this.createPaymentSnapshot(order.id, PaymentMethod.MOMO, money, tx);

        const amount = Number(money);

        if (
            !this.momoPartnerCode ||
            !this.momoAccessKey ||
            !this.momoSecretKey
        ) {
            return this.buildMockMoMoResponse(order.id, amount);
        }

        try {
            return await getMomoPayUrl(
                this.momoPartnerCode,
                this.momoAccessKey,
                this.momoSecretKey,
                amount,
                order.id,
            );
        } catch {
            return this.buildMockMoMoResponse(order.id, amount);
        }
    }

    async createCashPayment(
        orderId: number,
        money: number | Prisma.Decimal,
        tx: TransactionClientExtended | PrismaService = this.prismaService,
    ) {
        const order = await tx.order.findFirst({
            where: {
                id: orderId,
            },
        });
        if (!order) {
            throw new NotFoundException('Order not found');
        }

        return await this.createPaymentSnapshot(
            order.id,
            PaymentMethod.CASH,
            money,
            tx,
        );
    }

    async checkingPayment(
        orderId: number,
        status: PaymentStatus = PaymentStatus.DONE,
    ) {
        const payment = await this.prismaService.client.payment.findFirst({
            where: {
                orderId,
            },
        });
        if (!payment) {
            throw new BadRequestException(
                `Payment not found for order ${orderId}`,
            );
        }

        return await this.prismaService.client.payment.update({
            where: {
                id: payment.id,
            },
            data: {
                paymentStatus: status,
            },
        });
    }

    async getPaymentDetail(orderId: number) {
        return await this.getPaymentByOrderId(orderId);
    }
}
