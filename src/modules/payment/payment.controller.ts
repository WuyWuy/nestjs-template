import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckingPaymentDto } from './dto/payment.dto';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import type { Request } from 'express';

@ApiTags('10. Thanh toán')
@Controller('payment')
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) {}

    @ApiOperation({ summary: 'Nhận webhook cập nhật trạng thái thanh toán' })
    @Post('check-payment')
    async checkPayment(@Body() data: CheckingPaymentDto) {
        const response = await this.paymentService.updateMoMoPaymentStatus(
            data.momoOrderId,
            data.status,
        );
        return response;
    }

    @ApiOperation({ summary: 'Xem chi tiết thanh toán theo đơn hàng' })
    @Get(':orderId')
    async getPaymentDetail(@Param('orderId', ParseIntPipe) orderId: number) {
        return await this.paymentService.getPaymentDetail(orderId);
    }

    @ApiOperation({ summary: 'Xác nhận thanh toán, dành cho admin/business' })
    @ApiBearerAuth()
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch('manage/:paymentId/confirm')
    async confirmPayment(
        @Param('paymentId', ParseIntPipe) paymentId: number,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.paymentService.confirmPayment(
            paymentId,
            Number(user.id),
            user.roles ?? [],
        );
    }
}
