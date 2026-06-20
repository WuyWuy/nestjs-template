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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('09. Đơn hàng')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
    constructor(private readonly orderSerivce: OrderService) {}

    @ApiOperation({ summary: 'Tạo đơn hàng mới' })
    @Roles(Role.CUSTOMER)
    @Post()
    async createOrder(@Body() data: CreateOrderDto, @Req() req: Request) {
        const user = req.user as { id?: number };
        return await this.orderSerivce.createOrder(Number(user.id), data);
    }

    @ApiOperation({ summary: 'Đặt lại từ đơn hàng cũ' })
    @Roles(Role.CUSTOMER)
    @Post('/:orderId/reorder')
    async reorder(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number };
        return await this.orderSerivce.reorder(Number(user.id), orderId);
    }

    @ApiOperation({ summary: 'Lấy danh sách đơn hàng' })
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

    @ApiOperation({ summary: 'Xem chi tiết đơn hàng' })
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

    @ApiOperation({ summary: 'Xem trạng thái đơn hàng' })
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

    @ApiOperation({ summary: 'Xóa đơn hàng' })
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

    @ApiOperation({ summary: 'Hủy đơn theo endpoint tương thích' })
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

    @ApiOperation({ summary: 'Cập nhật trạng thái đơn hàng' })
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
