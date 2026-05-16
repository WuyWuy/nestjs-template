import {
    Body,
    Controller,
    DefaultValuePipe,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { CreateReviewDto } from './dto/review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import type { Request } from 'express';

@Controller('restaurant')
export class RestaurantController {
    constructor(private readonly restaurantService: RestaurantService) {}

    // NOTE FOR REVIEWERS / FE:
    // - This controller exposes a per-restaurant stats route used by the frontend
    //   to render analytics for a single restaurant (orders, revenue, rating, menu size).
    // - FE should coordinate with backend on which time-range and granularity are
    //   required. Current implementation returns overall totals; to add time-based
    //   aggregations we will accept `from`/`to` query params and granularity.
    // - Authorization: statistics endpoints are currently protected in service logic
    //   (if needed) — confirm whether these should be public (for listing pages)
    //   or require authentication (for owner/admin dashboard).

    @Get()
    async getAllRestauant(
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
        @Query('name', new DefaultValuePipe('')) name: string,
        @Query('phone', new DefaultValuePipe('')) phone: string,
    ) {
        return this.restaurantService.getAllRestaurants(
            limit,
            offset,
            name,
            phone,
        );
    }

    @Get('stats/:restaurantId')
    async getRestaurantStats(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantStats(restaurantId);
    }

    @Get('menu/:restaurantId')
    async getRestaurantMenu(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantMenu(restaurantId);
    }

    @Get('detail/:restaurantId')
    async getRestaurantDetail(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantInDetail(restaurantId);
    }

    /**
     * Lấy danh sách review của nhà hàng
     * Route: GET /restaurant/reviews/:restaurantId
     */
    @Get('reviews/:restaurantId')
    async getRestaurantReviews(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    ) {
        return this.restaurantService.getRestaurantReviews(
            restaurantId,
            limit,
            offset,
        );
    }

    /**
        * Lấy thông tin cơ bản của nhà hàng (dùng cho listing hoặc preview)
        * Route: GET /restaurant/basic/:restaurantId
        * Trả về object chứa các trường sau:
        *  - id: ID của nhà hàng
        *  - name: Tên nhà hàng
        *  - image: URL ảnh đại diện (chuỗi rỗng nếu không có)
        *  - phone: Số điện thoại liên hệ
        *  - address: object rút gọn (id, title, latitude, longitude, fullText)
        *  - averageRating: điểm trung bình (float, giá trị 0 nếu chưa có review)
        * Lỗi:
        *  - 404 nếu nhà hàng không tồn tại hoặc đã bị xóa mềm
        */
    @Get('basic/:restaurantId')
    async getRestaurantBasic(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantBasic(restaurantId);
    }

    /**
     * Gửi và lưu review (đánh giá) cho nhà hàng
     * Route: POST /restaurant/reviews/:restaurantId
     * Role: CUSTOMER (khách hàng)
     */
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('reviews/:restaurantId')
    async createReview(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Body() data: CreateReviewDto,
        @Req() req: Request,
    ) {
        // Lấy ID khách hàng từ JWT token
        const userId = (req.user as any).id;
        
        // Gọi service để tạo review
        // Truyền: userId, restaurantId, và dữ liệu review (vote, comment)
        const response = await this.restaurantService.createReview(
            userId,
            restaurantId,
            data,
        );
        return response;
    }
}
