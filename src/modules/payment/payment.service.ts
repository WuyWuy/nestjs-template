import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    PaymentMethod,
    PaymentStatus,
    Prisma,
    Role,
    NotificationType,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { getMomoPayUrl } from './payment.utls';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionClientExtended } from '@/prisma/custom-prisma-client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEvent } from '../notification/events/notification.event';

@Injectable()
export class PaymentService {
    private readonly momoAccessKey?: string;
    private readonly momoSecretKey?: string;
    private readonly momoPartnerCode?: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly prismaService: PrismaService,
        private readonly auditService: AuditService,
        private readonly eventEmitter: EventEmitter2,
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
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://sandbox.momo.vn/mock-pay?orderId=${orderId}%26amount=${money}`,
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

    async confirmPayment(
        paymentId: number,
        actorId: number,
        roles: string[],
    ) {
        const payment = await this.prismaService.client.payment.findUnique({
            where: { id: paymentId },
            include: {
                order: {
                    select: {
                        id: true,
                        restaurantId: true,
                        status: true,
                        userId: true,
                    },
                },
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        await this.assertRestaurantOwner(actorId, roles, payment.order.restaurantId);

        const updatedPayment = await this.prismaService.client.$transaction(async (tx) => {
            const res = await tx.payment.update({
                where: { id: paymentId },
                data: {
                    paymentStatus: PaymentStatus.DONE,
                },
            });

            return res;
        });

        try {
            this.eventEmitter.emit('notification.send', {
                recipientUserId: payment.order.userId,
                title: 'Payment Confirmed',
                body: `Your payment of $${payment.amount} for order #${payment.order.id} has been confirmed.`,
                type: NotificationType.PAYMENT,
                targetType: 'ORDER',
                targetId: payment.order.id,
                actorId,
                metadata: {
                    orderId: payment.order.id,
                    paymentId: payment.id,
                    amount: payment.amount,
                }
            } as NotificationEvent);
        } catch (err) {
            console.error('Error emitting payment confirmation notification:', err);
        }

        await this.auditService.log(
            'CONFIRM_PAYMENT',
            'Payment',
            paymentId,
            actorId,
            { amount: Number(payment.amount) },
        );

        return {
            ...updatedPayment,
            amount: Number(updatedPayment.amount),
        };
    }

    private async assertRestaurantOwner(
        actorId: number,
        roles: string[],
        restaurantId: number,
    ) {
        const restaurant = await this.prismaService.client.restaurant.findFirst({
            where: {
                id: restaurantId,
            },
            select: {
                id: true,
                ownerId: true,
            },
        });

        if (!restaurant) {
            throw new NotFoundException('Restaurant not found');
        }

        if (roles.includes(Role.ADMIN)) {
            return;
        }

        if (restaurant.ownerId !== actorId) {
            throw new ForbiddenException(
                'You are not allowed to manage this restaurant',
            );
        }
    }
}
