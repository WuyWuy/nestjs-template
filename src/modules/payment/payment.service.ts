import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { getMomoPayUrl } from './payment.utls';
import { PrismaService } from '@/prisma/prisma.service';
import { TransactionClientExtended } from '@/prisma/custom-prisma-client';
@Injectable()
export class PaymentService {
    private readonly momoAccessKey: string;
    private readonly momoSecretKey: string;
    private readonly momoPartnerCode: string;

    //___________HELPER
    constructor(
        private readonly configService: ConfigService,
        private readonly prismaService: PrismaService,
    ) {
        this.momoAccessKey =
            this.configService.getOrThrow<string>('MOMO_ACCESS_KEY');
        this.momoSecretKey =
            this.configService.getOrThrow<string>('MOMO_SECRET_KEY');
        this.momoPartnerCode =
            this.configService.getOrThrow<string>('MOMO_PARTNER_CODE');
    }
    /**
     * Create a payment snapshot for an order.
     * Prevents duplicate payments by checking if one already exists.
     */
    async createPaymentSnapshot(
        orderId: number,
        method: PaymentMethod,
        money: number | Prisma.Decimal,
        tx: PrismaService | TransactionClientExtended = this.prismaService,
    ) {
        // Check if payment already exists for this order (prevents paying twice)
        const existingPayment = await tx.payment.findFirst({
            where: { orderId },
        });
        if (existingPayment) {
            throw new BadRequestException(
                `Payment already exists for order ${orderId}. One order can only be paid once.`,
            );
        }

        const payment = await tx.payment.create({
            data: {
                orderId: orderId,
                amount: money,
                method: method,
                paymentStatus: PaymentStatus.UNPAID,
            },
        });
        return payment;
    }
    // MoMo Payment Method

    /**
     * Update MoMo payment status from webhook callback.
     * Extracts order ID from MoMo's format: requestId-orderId
     */
    async updateMoMoPaymentStatus(momoOrderId: string, status: PaymentStatus) {
        try {
            let orderId = momoOrderId;
            if (momoOrderId.includes('-')) orderId = momoOrderId.split('-')[1];
            if (!orderId || isNaN(Number(orderId))) {
                throw new BadRequestException('Order ID in invalid format');
            }

            const payment = await this.prismaService.client.payment.update({
                where: {
                    orderId: Number(orderId),
                },
                data: {
                    paymentStatus: status,
                },
            });
            return payment;
        } catch (err) {
            console.error(
                `Failed to update MoMo payment status for order ${momoOrderId}:`,
                err,
            );
            throw new BadRequestException('Failed to update payment status');
        }
    }
    /**
     * Create MoMo payment and return payment URL.
     * Amount should be in VND (whole units).
     */
    async createMoMoPayment(
        orderId: number,
        money: number | Prisma.Decimal,
        tx: TransactionClientExtended | PrismaService = this.prismaService,
    ) {
        try {
            // Verify order exists
            const order = await tx.order.findFirst({
                where: {
                    id: orderId,
                },
            });
            if (!order) {
                throw new NotFoundException('Order not found');
            }

            // Create payment snapshot (will throw if payment already exists)
            await this.createPaymentSnapshot(
                order.id,
                PaymentMethod.MOMO,
                money,
                tx,
            );

            // Generate MoMo payment URL
            const payUrl = await getMomoPayUrl(
                this.momoPartnerCode,
                this.momoAccessKey,
                this.momoSecretKey,
                Number(money) * 1000, // Convert VND to smallest unit
                order.id,
            );
            return payUrl;
        } catch (err) {
            console.error(
                'Failed to create MoMo payment for order:',
                orderId,
                err,
            );
            throw err;
        }
    }
    /**
     * Create cash payment record for an order.
     * Cash payments start as PENDING and are marked DONE on order confirmation.
     */
    async createCashPayment(
        orderId: number,
        money: number | Prisma.Decimal,
        tx: TransactionClientExtended | PrismaService = this.prismaService,
    ) {
        try {
            const order = await tx.order.findFirst({
                where: {
                    id: orderId,
                },
            });
            if (!order) {
                throw new NotFoundException('Order not found');
            }

            const payment = await this.createPaymentSnapshot(
                order.id,
                PaymentMethod.CASH,
                money,
                tx,
            );
            return payment;
        } catch (err) {
            console.error(
                'Failed to create cash payment for order:',
                orderId,
                err,
            );
            throw err;
        }
    }

    /**
     * Check and update payment status.
     * Verifies payment exists and updates to the given status.
     */
    async checkingPayment(
        orderId: number,
        status: PaymentStatus = PaymentStatus.DONE,
    ) {
        try {
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

            const result = await this.prismaService.client.payment.update({
                where: {
                    id: payment.id,
                },
                data: {
                    paymentStatus: status,
                },
            });
            return result;
        } catch (err) {
            console.error(
                'Failed to check/update payment for order:',
                orderId,
                err,
            );
            throw err;
        }
    }
}
