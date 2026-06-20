import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Put,
    Body,
    UseGuards,
    Req,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { RestaurantService } from './restaurant.service';
import { ApproveRestaurantDto, RejectRestaurantDto, GetRegistrationsQueryDto } from './dto/restaurant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminRoleMiddleware } from '@/bases/middlewares/admin-role.middleware';

@Controller('restaurant')
export class RestaurantController {
    constructor(private readonly restaurantService: RestaurantService) {}

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('/my')
    async getMyRestaurants(@Req() req: Request) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.restaurantService.getMyRestaurants(
            Number(user.id),
            user.roles ?? [],
        );
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('/manage')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'image', maxCount: 1 },
            { name: 'coverImage', maxCount: 1 },
        ]),
    )
    async createRestaurant(
        @Req() req: Request,
        @Body() data: CreateRestaurantDto,
        @UploadedFiles() files: RestaurantUploadFiles,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.restaurantService.createRestaurant(
            Number(user.id),
            data,
            user.roles ?? [],
            files,
        );
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch('/manage/:restaurantId')
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: 'image', maxCount: 1 },
            { name: 'coverImage', maxCount: 1 },
        ]),
    )
    async updateRestaurant(
        @Req() req: Request,
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Body() data: UpdateRestaurantDto,
        @UploadedFiles() files: RestaurantUploadFiles,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.restaurantService.updateRestaurant(
            Number(user.id),
            user.roles ?? [],
            restaurantId,
            data,
            files,
        );
    }

    @Get()
    async getAllRestauant(@Query() query: GetRestaurantsQueryDto) {
        return this.restaurantService.getAllRestaurants(
            query.limit ?? 20,
            query.offset ?? 0,
            query.keyword ?? '',
            query.categoryId,
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
        @Query() query: GetRestaurantMenuQueryDto,
    ) {
        return this.restaurantService.getRestaurantMenu(
            restaurantId,
            query.keyword ?? '',
            query.categoryId,
        );
    }

    @Get('/reviews/:restaurantId')
    async getRestaurantReviews(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantRatings(restaurantId);
    }

    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('/reviews/:restaurantId')
    async createRestaurantReview(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Body() data: CreateRestaurantRatingDto,
        @Req() req: Request,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        return this.restaurantService.createRestaurantRating(
            restaurantId,
            userId,
            data,
        );
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
