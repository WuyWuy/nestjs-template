import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CheckingPaymentDto } from './dto/payment.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) {}

    @Post('check-payment')
    async checkPayment(@Body() data: CheckingPaymentDto) {
        const response = await this.paymentService.updateMoMoPaymentStatus(
            data.momoOrderId,
            data.status,
        );
        return response;
    }

    @Get(':orderId')
    async getPaymentDetail(@Param('orderId', ParseIntPipe) orderId: number) {
        return await this.paymentService.getPaymentDetail(orderId);
    }
}
