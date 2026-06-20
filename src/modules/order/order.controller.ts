import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import {
    CreateOrderDto,
    GetOrdersQueryDto,
    UpdateOrderStatus,
} from './dto/order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import type { Request } from 'express';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
    constructor(private readonly orderSerivce: OrderService) {}

    @Roles(Role.CUSTOMER)
    @Post()
    async createOrder(@Body() data: CreateOrderDto, @Req() req: Request) {
        const user = req.user as { id?: number };
        return await this.orderSerivce.createOrder(Number(user.id), data);
    }

    @Get()
    async getAllOrders(@Req() req: Request, @Query() query: GetOrdersQueryDto) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.orderSerivce.getAllOrders(
            Number(user.id),
            user.roles ?? [],
            query.limit ?? 20,
            query.offset ?? 0,
            query.status,
        );
    }

    @Get('/:orderId')
    async getOrderDetail(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.orderSerivce.getOrderDetail(
            Number(user.id),
            user.roles ?? [],
            orderId,
        );
    }

    @Get('/:orderId/status')
    async getOrderStatus(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.orderSerivce.getOrderStatus(
            Number(user.id),
            user.roles ?? [],
            orderId,
        );
    }

    @Delete('/:orderId')
    async cancelOrder(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.orderSerivce.deleteOrderById(
            Number(user.id),
            user.roles ?? [],
            orderId,
        );
    }

    @Post('/:orderId/cancel')
    async cancelOrderCompatible(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.orderSerivce.cancelOrderCompatible(
            Number(user.id),
            user.roles ?? [],
            orderId,
        );
    }

    @Patch('/:orderId')
    async updateOrderStatus(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Req() req: Request,
        @Body() data: UpdateOrderStatus,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.orderSerivce.updateOrderStatus(
            Number(user.id),
            user.roles ?? [],
            orderId,
            data,
        );
    }
}
