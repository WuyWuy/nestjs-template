import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCouponDto, UpdateCouponDto } from './coupon.dto';

@Injectable()
export class CouponService {
    constructor(private readonly prismaService: PrismaService) {}

    async getCoupons(limit: number, offset: number, code: string) {
        const where = {
            deleteAt: null,
            code: code ? { contains: code, mode: 'insensitive' } : undefined,
        };

        const data = await this.prismaService.coupon.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            include: {
                restaurant: {
                    select: { id: true, name: true },
                },
                createdBy: {
                    select: { id: true, email: true },
                },
            },
        });

        const total = await this.prismaService.coupon.count({ where });
        return { data, total, limit, offset };
    }

    async getCoupon(id: number) {
        const coupon = await this.prismaService.coupon.findFirst({
            where: { id, deleteAt: null },
            include: {
                restaurant: {
                    select: { id: true, name: true },
                },
                createdBy: {
                    select: { id: true, email: true },
                },
            },
        });
        if (!coupon) throw new NotFoundException('Coupon not found');
        return coupon;
    }

    // Coupon quản lý bởi admin: lấy danh sách coupon toàn hệ thống
    async getAdminCoupons(limit: number, offset: number, code: string) {
        const where = {
            deleteAt: null,
            code: code ? { contains: code, mode: 'insensitive' } : undefined,
        };

        const data = await this.prismaService.coupon.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
            include: {
                restaurant: {
                    select: { id: true, name: true },
                },
                createdBy: {
                    select: { id: true, email: true },
                },
            },
        });
        const total = await this.prismaService.coupon.count({ where });
        return { data, total, limit, offset };
    }

    async createAdminCoupon(dto: CreateCouponDto) {
        return this.prismaService.coupon.create({
            data: {
                ...dto,
                startDate: new Date(dto.startDate),
                endDate: new Date(dto.endDate),
                isActive: dto.isActive ?? true,
                minOrderValue: dto.minOrderValue ?? 0,
            },
        });
    }

    async updateAdminCoupon(id: number, dto: UpdateCouponDto) {
        const coupon = await this.prismaService.coupon.findFirst({
            where: { id, deleteAt: null },
        });
        if (!coupon) throw new NotFoundException('Coupon not found');

        return this.prismaService.coupon.update({
            where: { id },
            data: {
                ...dto,
                startDate: dto.startDate ? new Date(dto.startDate) : undefined,
                endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            },
        });
    }

    async deleteAdminCoupon(id: number) {
        const coupon = await this.prismaService.coupon.findFirst({
            where: { id, deleteAt: null },
        });
        if (!coupon) throw new NotFoundException('Coupon not found');

        return this.prismaService.coupon.update({
            where: { id },
            data: { deleteAt: new Date() },
        });
    }

    async getRestaurantCoupons(userId: number, limit: number, offset: number) {
        const restaurants = await this.prismaService.restaurant.findMany({
            where: { ownerId: userId, deleteAt: null },
            select: { id: true },
        });
        const restaurantIds = restaurants.map((restaurant) => restaurant.id);

        const where = {
            deleteAt: null,
            restaurantId: { in: restaurantIds.length ? restaurantIds : [0] },
        };

        const data = await this.prismaService.coupon.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
        });
        const total = await this.prismaService.coupon.count({ where });
        return { data, total, limit, offset };
    }

    // Coupon của restaurant: chỉ owner của nhà hàng mới tạo được coupon
    async createRestaurantCoupon(userId: number, dto: CreateCouponDto) {
        if (!dto.restaurantId) {
            throw new BadRequestException('restaurantId is required for restaurant coupon');
        }

        const restaurant = await this.prismaService.restaurant.findFirst({
            where: { id: dto.restaurantId, ownerId: userId, deleteAt: null },
        });
        if (!restaurant) {
            throw new NotFoundException('Restaurant not found or not owned by user');
        }

        return this.prismaService.coupon.create({
            data: {
                ...dto,
                restaurantId: dto.restaurantId,
                createdById: userId,
                startDate: new Date(dto.startDate),
                endDate: new Date(dto.endDate),
                isActive: dto.isActive ?? true,
                minOrderValue: dto.minOrderValue ?? 0,
            },
        });
    }

    async updateRestaurantCoupon(userId: number, id: number, dto: UpdateCouponDto) {
        const coupon = await this.prismaService.coupon.findFirst({
            where: { id, deleteAt: null },
            include: { restaurant: true },
        });
        if (!coupon) throw new NotFoundException('Coupon not found');
        if (!coupon.restaurantId || coupon.restaurant.ownerId !== userId) {
            throw new BadRequestException('Not authorized to update this coupon');
        }

        return this.prismaService.coupon.update({
            where: { id },
            data: {
                ...dto,
                restaurantId: dto.restaurantId,
                startDate: dto.startDate ? new Date(dto.startDate) : undefined,
                endDate: dto.endDate ? new Date(dto.endDate) : undefined,
            },
        });
    }

    async deleteRestaurantCoupon(userId: number, id: number) {
        const coupon = await this.prismaService.coupon.findFirst({
            where: { id, deleteAt: null },
            include: { restaurant: true },
        });
        if (!coupon) throw new NotFoundException('Coupon not found');
        if (!coupon.restaurantId || coupon.restaurant.ownerId !== userId) {
            throw new BadRequestException('Not authorized to delete this coupon');
        }

        return this.prismaService.coupon.update({
            where: { id },
            data: { deleteAt: new Date() },
        });
    }

    // Báo cáo tổng doanh thu và tổng số đơn hàng - tính toán cho admin toàn hệ thống
    // Comment: Phương thức này tính tổng doanh thu (totalRevenue) và tổng số đơn hàng (totalOrders) từ bảng Order
    // Sử dụng Prisma aggregate để tính tổng totalPrice và count để đếm số đơn hàng
    // Dễ merge: Logic tính toán đơn giản, không phụ thuộc vào coupon, chỉ query Order table
    async getOrderReport() {
        // Tính tổng số đơn hàng
        const totalOrders = await this.prismaService.order.count({
            where: { /* Có thể thêm filter nếu cần, ví dụ: status: 'COMPLETED' */ }
        });

        // Tính tổng doanh thu bằng cách sum totalPrice của tất cả orders
        const revenueAggregate = await this.prismaService.order.aggregate({
            _sum: {
                totalPrice: true,
            },
            where: { /* Có thể thêm filter nếu cần */ }
        });

        const totalRevenue = revenueAggregate._sum.totalPrice || 0;

        return {
            totalOrders,
            totalRevenue,
        };
    }
}
