import {
    Body,
    Controller,
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
} from './dto/restaurant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import type { Express, Request } from 'express';

type RestaurantUploadFiles = {
    image?: Express.Multer.File[];
    coverImage?: Express.Multer.File[];
};

@Controller('restaurant')
export class RestaurantController {
    constructor(private readonly restaurantService: RestaurantService) { }

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

    @Get()
    async getAllRestauant(@Query() query: GetRestaurantsQueryDto) {
        return this.restaurantService.getAllRestaurants(
            query.limit ?? 20,
            query.offset ?? 0,
            query.keyword ?? '',
            query.categoryId,
            query.latitude,
            query.longitude,
            query.minRating,
            query.sortBy,
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

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('/reviews/:reviewId/reply')
    async replyToRestaurantReview(
        @Param('reviewId', ParseIntPipe) reviewId: number,
        @Body() body: CreateRestaurantRatingReplyDto,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.restaurantService.replyToRestaurantRating(
            reviewId,
            Number(user.id),
            user.roles ?? [],
            body.reply,
        );
    }
}
