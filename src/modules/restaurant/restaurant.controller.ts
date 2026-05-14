import {
    Controller,
    DefaultValuePipe,
    Get,
    Param,
    ParseIntPipe,
    Query,
    Put,
    Body,
    UseGuards,
    Req,
} from '@nestjs/common';
import { RestaurantService } from './restaurant.service';
import { ApproveRestaurantDto, RejectRestaurantDto, GetRegistrationsQueryDto } from './dto/restaurant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRoleMiddleware } from '@/bases/middlewares/admin-role.middleware';

@Controller('restaurant')
export class RestaurantController {
    constructor(private readonly restaurantService: RestaurantService) {}

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

    @Get('/detail/:restaurantId')
    async getRestaurantDetail(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantInDetail(restaurantId);
    }

    @Get('/menu/:restaurantId')
    async getRestaurantMenu(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantMenu(restaurantId);
    }

    /**
     * Admin: Get all pending restaurant registrations
     */
    // Admin endpoint: Lấy danh sách các nhà hàng chờ duyệt
    @Get('admin/registrations')
    @UseGuards(JwtAuthGuard)
    async getPendingRegistrations(
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    ) {
        return this.restaurantService.getPendingRegistrations(limit, offset);
    }

    /**
     * Admin: Approve restaurant registration
     */
    // Admin endpoint: Duyệt đơn đăng ký nhà hàng
    @Put('admin/approve/:restaurantId')
    @UseGuards(JwtAuthGuard)
    async approveRestaurant(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.approveRestaurant(restaurantId);
    }

    /**
     * Admin: Reject restaurant registration
     */
    // Admin endpoint: Từ chối đơn đăng ký nhà hàng
    @Put('admin/reject/:restaurantId')
    @UseGuards(JwtAuthGuard)
    async rejectRestaurant(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Body() dto: RejectRestaurantDto,
    ) {
        return this.restaurantService.rejectRestaurant(restaurantId, dto.rejectionReason);
    }
}