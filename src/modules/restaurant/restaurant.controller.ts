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
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { RestaurantService } from './restaurant.service';
import {
    CreateRestaurantDto,
    CreateRestaurantRatingDto,
    GetRestaurantMenuQueryDto,
    GetRestaurantsQueryDto,
    UpdateRestaurantDto,
    UpdateRestaurantStatusDto,
    UpdateOperatingHoursDto,
    CreateRestaurantRatingReplyDto,
    UpdateRestaurantRatingDto,
} from './dto/restaurant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import type { Express, Request } from 'express';

type RestaurantUploadFiles = {
    image?: Express.Multer.File[];
    coverImage?: Express.Multer.File[];
};

@ApiTags('06. Restaurant')
@Controller('restaurant')
export class RestaurantController {
    constructor(private readonly restaurantService: RestaurantService) { }

    @ApiOperation({ summary: 'Xem danh sách nhà hàng của tôi' })
    @ApiBearerAuth()
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

    @ApiOperation({ summary: 'Tạo nhà hàng mới' })
    @ApiBearerAuth()
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['name', 'phone', 'addressId'],
            properties: {
                name: {
                    type: 'string',
                    example: 'Burger Town',
                },
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh đại diện nhà hàng',
                },
                coverImage: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh bìa nhà hàng',
                },
                description: {
                    type: 'string',
                    example:
                        'Fast casual burger shop with smash patties and crispy fries.',
                },
                phone: {
                    type: 'string',
                    example: '02873000001',
                },
                addressId: {
                    type: 'number',
                    example: 1,
                },
                deliveryFee: {
                    type: 'number',
                    example: 2,
                },
                minimumOrder: {
                    type: 'number',
                    example: 8,
                },
                estimatedDeliveryTime: {
                    type: 'number',
                    example: 25,
                },
            },
        },
    })
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

    @ApiOperation({ summary: 'Cập nhật nhà hàng' })
    @ApiBearerAuth()
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    example: 'Burger Town Express',
                },
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh đại diện mới',
                },
                coverImage: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh bìa mới',
                },
                description: {
                    type: 'string',
                    example: 'Updated restaurant description.',
                },
                phone: {
                    type: 'string',
                    example: '02873000009',
                },
                addressId: {
                    type: 'number',
                    example: 1,
                },
                deliveryFee: {
                    type: 'number',
                    example: 2.5,
                },
                minimumOrder: {
                    type: 'number',
                    example: 10,
                },
                estimatedDeliveryTime: {
                    type: 'number',
                    example: 30,
                },
            },
        },
    })
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

    @ApiOperation({ summary: 'Xem dashboard nhà hàng' })
    @ApiBearerAuth()
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('/manage/:restaurantId/dashboard')
    async getRestaurantDashboard(
        @Req() req: Request,
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Query('range') range: 'day' | 'week' | 'month' = 'day',
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.restaurantService.getRestaurantDashboard(
            restaurantId,
            Number(user.id),
            user.roles ?? [],
            range,
        );
    }

    @ApiOperation({ summary: 'Xem doanh thu nhà hàng' })
    @ApiBearerAuth()
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('/manage/:restaurantId/revenue')
    async getRestaurantRevenue(
        @Req() req: Request,
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.restaurantService.getRestaurantRevenue(
            restaurantId,
            Number(user.id),
            user.roles ?? [],
        );
    }

    @ApiOperation({ summary: 'Bật hoặc tắt trạng thái mở cửa nhà hàng' })
    @ApiBearerAuth()
    @ApiBody({
        type: UpdateRestaurantStatusDto,
        examples: {
            open: {
                summary: 'Mở cửa nhà hàng',
                value: {
                    isOpen: true,
                },
            },
            close: {
                summary: 'Đóng cửa nhà hàng',
                value: {
                    isOpen: false,
                },
            },
        },
    })
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch('/manage/:restaurantId/status')
    async updateRestaurantStatus(
        @Req() req: Request,
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Body() body: UpdateRestaurantStatusDto,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.restaurantService.updateRestaurantStatus(
            restaurantId,
            Number(user.id),
            user.roles ?? [],
            body.isOpen,
        );
    }

    @ApiOperation({ summary: 'Cập nhật giờ hoạt động nhà hàng' })
    @ApiBearerAuth()
    @ApiBody({
        type: UpdateOperatingHoursDto,
        examples: {
            example: {
                summary: 'Giờ hoạt động trong tuần',
                value: {
                    operatingHours: {
                        monday: {
                            open: '08:00',
                            close: '22:00',
                        },
                        tuesday: {
                            open: '08:00',
                            close: '22:00',
                        },
                        saturday: {
                            open: '09:00',
                            close: '23:00',
                        },
                        sunday: {
                            open: '09:00',
                            close: '21:00',
                        },
                    },
                },
            },
        },
    })
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch('/manage/:restaurantId/operating-hours')
    async updateRestaurantOperatingHours(
        @Req() req: Request,
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Body() body: UpdateOperatingHoursDto,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.restaurantService.updateRestaurantOperatingHours(
            restaurantId,
            Number(user.id),
            user.roles ?? [],
            body.operatingHours,
        );
    }

    @ApiOperation({ summary: 'Khám phá danh sách nhà hàng' })
    @UseGuards(OptionalJwtAuthGuard)
    @Get()
    async getAllRestauant(@Query() query: GetRestaurantsQueryDto, @Req() req: Request) {
        const userId = (req.user as { id?: number })?.id ? Number((req.user as { id?: number })?.id) : undefined;
        return this.restaurantService.getAllRestaurants(
            query.limit ?? 20,
            query.offset ?? 0,
            query.keyword ?? '',
            query.categoryId,
            query.latitude,
            query.longitude,
            query.minRating,
            query.sortBy,
            userId,
        );
    }

    @ApiOperation({ summary: 'Xem chi tiết nhà hàng' })
    @Get('/detail/:restaurantId')
    async getRestaurantDetail(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantInDetail(restaurantId);
    }

    @ApiOperation({ summary: 'Xem menu của nhà hàng' })
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

    @ApiOperation({ summary: 'Xem review của nhà hàng' })
    @Get('/reviews/:restaurantId')
    async getRestaurantReviews(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantRatings(restaurantId);
    }

    @ApiOperation({ summary: 'Tạo review cho nhà hàng, dành cho khách hàng' })
    @ApiBearerAuth()
    @ApiBody({
        type: CreateRestaurantRatingDto,
        examples: {
            example: {
                summary: 'Review nhà hàng',
                value: {
                    vote: 5,
                    comment: 'Đồ ăn ngon, đóng gói cẩn thận.',
                },
            },
        },
    })
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

    @ApiOperation({ summary: 'Cập nhật đánh giá, dành cho khách hàng' })
    @ApiBearerAuth()
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch('/reviews/:reviewId')
    async updateRestaurantReview(
        @Param('reviewId', ParseIntPipe) reviewId: number,
        @Body() data: UpdateRestaurantRatingDto,
        @Req() req: Request,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        const result = await this.restaurantService.updateRestaurantRating(
            reviewId,
            userId,
            data,
        );
        return {
            success: true,
            message: 'Update review successfully',
            data: {
                id: result.id,
                vote: result.vote,
                comment: result.comment,
                tags: result.tags,
                updatedAt: new Date(),
            },
        };
    }

    @ApiOperation({ summary: 'Xóa đánh giá, dành cho khách hàng hoặc admin' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Delete('/reviews/:reviewId')
    async deleteRestaurantReview(
        @Param('reviewId', ParseIntPipe) reviewId: number,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.restaurantService.deleteRestaurantRating(
            reviewId,
            Number(user.id),
            user.roles ?? [],
        );
    }

    @ApiOperation({ summary: 'Lấy danh sách review của nhà hàng (Vendor View)' })
    @ApiBearerAuth()
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('/manage/:restaurantId/reviews')
    async getRestaurantReviewsForVendor(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        const data = await this.restaurantService.getRestaurantRatingsForVendor(
            restaurantId,
            Number(user.id),
            user.roles ?? [],
        );
        return {
            success: true,
            data,
        };
    }

    @ApiOperation({ summary: 'Trả lời review nhà hàng, dành cho admin/business' })
    @ApiBearerAuth()
    @ApiBody({
        type: CreateRestaurantRatingReplyDto,
        examples: {
            example: {
                summary: 'Phản hồi review',
                value: {
                    reply: 'Cảm ơn bạn đã ủng hộ nhà hàng.',
                },
            },
        },
    })
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('/reviews/:reviewId/reply')
    async replyToRestaurantReview(
        @Param('reviewId', ParseIntPipe) reviewId: number,
        @Body() body: CreateRestaurantRatingReplyDto,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        const result = await this.restaurantService.replyToRestaurantRating(
            reviewId,
            Number(user.id),
            user.roles ?? [],
            body.reply,
        );
        return {
            success: true,
            message: 'Reply added successfully',
            data: {
                id: result.id,
                reply: result.reply,
                replyCreatedAt: result.replyCreatedAt,
            },
        };
    }

    @ApiOperation({ summary: 'Thống kê đánh giá tại Dashboard (Rating Stats)' })
    @ApiBearerAuth()
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('/manage/:restaurantId/stats/ratings')
    async getRestaurantRatingStats(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        const data = await this.restaurantService.getRestaurantRatingStats(
            restaurantId,
            Number(user.id),
            user.roles ?? [],
        );
        return {
            success: true,
            data,
        };
    }
}
