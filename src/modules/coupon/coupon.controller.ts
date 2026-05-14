import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Query,
    Req,
    DefaultValuePipe,
    UseGuards,
} from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CreateCouponDto, UpdateCouponDto } from './coupon.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import type { Request } from 'express';

// Coupon API for both admin and restaurant owners
// - /coupon/admin: admin quản lý coupon toàn hệ thống
// - /coupon/restaurant: business/restaurant quản lý coupon riêng
@Controller('coupon')
export class CouponController {
    constructor(private readonly couponService: CouponService) {}

    @Get()
    async getCoupons(
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
        @Query('code', new DefaultValuePipe('')) code: string,
    ) {
        return this.couponService.getCoupons(limit, offset, code);
    }

    // Admin coupon endpoint: danh sách coupon toàn hệ thống
    @Get('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getAdminCoupons(
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
        @Query('code', new DefaultValuePipe('')) code: string,
    ) {
        return this.couponService.getAdminCoupons(limit, offset, code);
    }

    // Admin coupon endpoint: tạo coupon cho toàn hệ thống
    @Post('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async createAdminCoupon(@Body() dto: CreateCouponDto) {
        return this.couponService.createAdminCoupon(dto);
    }

    @Put('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async updateAdminCoupon(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCouponDto,
    ) {
        return this.couponService.updateAdminCoupon(id, dto);
    }

    @Delete('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async deleteAdminCoupon(@Param('id', ParseIntPipe) id: number) {
        return this.couponService.deleteAdminCoupon(id);
    }

    // Báo cáo tổng doanh thu và tổng số đơn hàng - endpoint cho admin
    // Comment: Endpoint này trả về tổng doanh thu và tổng số đơn hàng toàn hệ thống
    // Sử dụng service method getOrderReport() để tính toán
    // Dễ merge: Chỉ thêm endpoint mới, không ảnh hưởng logic cũ
    @Get('admin/report')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async getOrderReport() {
        return this.couponService.getOrderReport();
    }

    @Get('detail/:id')
    async getCoupon(@Param('id', ParseIntPipe) id: number) {
        return this.couponService.getCoupon(id);
    }

    // Restaurant coupon endpoint: danh sách coupon của nhà hàng do business sở hữu
    @Get('restaurant')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BUSINESS)
    async getRestaurantCoupons(
        @Req() req: Request,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    ) {
        return this.couponService.getRestaurantCoupons(
            Number((req.user as any).id),
            limit,
            offset,
        );
    }

    @Post('restaurant')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BUSINESS)
    async createRestaurantCoupon(
        @Req() req: Request,
        @Body() dto: CreateCouponDto,
    ) {
        return this.couponService.createRestaurantCoupon(
            Number((req.user as any).id),
            dto,
        );
    }

    @Put('restaurant/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BUSINESS)
    async updateRestaurantCoupon(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCouponDto,
    ) {
        return this.couponService.updateRestaurantCoupon(
            Number((req.user as any).id),
            id,
            dto,
        );
    }

    @Delete('restaurant/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.BUSINESS)
    async deleteRestaurantCoupon(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
    ) {
        return this.couponService.deleteRestaurantCoupon(
            Number((req.user as any).id),
            id,
        );
    }
}
