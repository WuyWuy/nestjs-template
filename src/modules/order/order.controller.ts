import {
    Body,
    Controller,
    DefaultValuePipe,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Query,
    Req,
    UseGuards,
    BadRequestException,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '@/prisma/prisma.service';

@Controller('orders')
export class OrderController {
    constructor(
        private readonly orderSerivce: OrderService,
        private readonly prismaService: PrismaService,
    ) {}

    // ============ API cho khách hàng ============

    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    async createOrder(@Body() data: CreateOrderDto, @Req() req: Request) {
        const userId = (req.user as any).id;
        const response = await this.orderSerivce.createOrder(
            Number(userId),
            data,
        );
        return response;
    }

    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get()
    async getAllUSerPayment(
        @Req() req: Request,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    ) {
        const userId = (req.user as any).id;
        const response = await this.orderSerivce.getAllOrders(
            Number(userId),
            limit,
            offset,
        );
        return response;
    }

    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('/:orderId')
    async getOrderDetail(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Req() req: Request,
    ) {
        const userId = (req.user as any).id;
        const response = await this.orderSerivce.getOrderDetail(
            Number(userId),
            orderId,
        );
        return response;
    }

    // ============ API cho chủ nhà hàng ============

    /**
     * Lấy danh sách đơn hàng đang ở trạng thái PENDING và PREPARING
     * cho chủ nhà hàng.
     * Route: GET /orders/restaurant/pending-preparing
     */
    @Roles(Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('restaurant/pending-preparing')
    async getPendingAndPreparingOrders(
        @Req() req: Request,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    ) {
        const userId = (req.user as any).id;

        // Tìm nhà hàng đang thuộc quyền sở hữu của user hiện tại
        const restaurant = await this.prismaService.client.restaurant.findFirst({
            where: {
                ownerId: Number(userId),
                deleteAt: null,
            },
        });

        if (!restaurant) {
            throw new BadRequestException(
                // Nếu không tìm thấy nhà hàng thì báo lỗi để FE biết user chưa có nhà hàng hợp lệ
                'Restaurant not found for this user',
            );
        }

        const response = await this.orderSerivce.getPendingAndPreparingOrders(
            restaurant.id,
            limit,
            offset,
        );
        return response;
    }

    /**
     * Cập nhật trạng thái đơn hàng (PREPARING ➔ DELIVERING)
     * và gửi push notification cho khách hàng
     * Route: PUT /orders/:orderId/status
     * Role: BUSINESS (Chủ nhà hàng)
     */
    @Roles(Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Put('/:orderId/status')
    async updateOrderStatus(
        @Param('orderId', ParseIntPipe) orderId: number,
        @Body() data: UpdateOrderStatusDto,
        @Req() req: Request,
    ) {
        // Lấy ID user từ JWT token (chủ nhà hàng)
        // Guard `JwtAuthGuard` đã đảm bảo token hợp lệ trước khi vào controller
        const userId = (req.user as any).id;

        // Tìm nhà hàng thuộc sở hữu của user hiện tại
        // Mục đích: đảm bảo chỉ chủ nhà hàng mới được thao tác trên đơn của nhà hàng
        const restaurant = await this.prismaService.client.restaurant.findFirst({
            where: {
                ownerId: Number(userId),
                deleteAt: null, // Bỏ qua nhà hàng đã bị xóa mềm
            },
        });

        // Nếu user không có nhà hàng hợp lệ -> trả lỗi cho client
        if (!restaurant) {
            throw new BadRequestException('Restaurant not found for this user');
        }

        // Gọi service xử lý cập nhật trạng thái đơn
        // Service đảm nhiệm các bước: kiểm tra đơn tồn tại, kiểm tra quyền sở hữu,
        // cập nhật DB và gửi push notification nếu cần.
        const response = await this.orderSerivce.updateOrderStatus(
            restaurant.id,
            orderId,
            data.status,
        );

        // Trả về kết quả (message + order đã cập nhật)
        return response;
    }
}
