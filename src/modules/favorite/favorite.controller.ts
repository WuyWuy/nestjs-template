import { Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FavoriteService } from './favorite.service';
import { FavoriteRestaurantsQueryDto } from './dto/favorite.dto';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '@/bases/guards/role.guard';
import type { Request } from 'express';

@ApiTags('17. Favorite')
@ApiBearerAuth()
@Controller()
export class FavoriteController {
    constructor(private readonly favoriteService: FavoriteService) {}

    @ApiOperation({ summary: 'Thêm/Bớt nhà hàng vào danh sách yêu thích' })
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('/restaurant/:restaurantId/like')
    async toggleFavorite(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Req() req: Request,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        const result = await this.favoriteService.toggleFavorite(userId, restaurantId);
        return {
            success: true,
            message: 'Update favorite status successfully',
            data: result,
        };
    }

    @ApiOperation({ summary: 'Lấy danh sách nhà hàng yêu thích' })
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('/user/favorites/restaurants')
    async getFavorites(
        @Query() query: FavoriteRestaurantsQueryDto,
        @Req() req: Request,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.favoriteService.getFavorites(
            userId,
            query.limit ?? 20,
            query.offset ?? 0,
        );
    }

    @ApiOperation({ summary: 'Kiểm tra trạng thái yêu thích' })
    @UseGuards(JwtAuthGuard)
    @Get('/restaurant/:restaurantId/like-status')
    async getLikeStatus(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Req() req: Request,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        const result = await this.favoriteService.getLikeStatus(userId, restaurantId);
        return result;
    }
}
