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
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Request } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '@/bases/decorators/role.decorators';
import { RolesGuard } from '@/bases/guards/role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FoodService } from './food.service';
import { CreateFoodDto, FoodQueryDto, UpdateFoodDto, CreateFoodRatingDto } from './dto/food.dto';

@ApiTags('07. Món ăn')
@Controller('food')
export class FoodController {
    constructor(private readonly foodService: FoodService) {}

    @ApiOperation({ summary: 'Lấy danh sách món ăn' })
    @Get()
    async getAllFood(@Query() query: FoodQueryDto) {
        return await this.foodService.getAllFood(query);
    }

    @ApiOperation({ summary: 'Lấy danh sách nguyên liệu' })
    @Get('ingredients')
    async getAllIngredients() {
        return await this.foodService.getAllIngredients();
    }

    @ApiOperation({ summary: 'Xem chi tiết một món ăn' })
    @Get('/:id')
    async getFoodDetail(@Param('id', ParseIntPipe) id: number) {
        return await this.foodService.getFoodDetail(id);
    }

    @ApiOperation({ summary: 'Đánh giá một món ăn, dành cho khách hàng' })
    @ApiBearerAuth()
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('/:id/ratings')
    async createFoodRating(
        @Req() req: Request,
        @Param('id', ParseIntPipe) foodId: number,
        @Body() body: CreateFoodRatingDto,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.foodService.createFoodRating(foodId, userId, body);
    }

    @ApiOperation({ summary: 'Lấy danh sách đánh giá của món ăn' })
    @Get('/:id/ratings')
    async getFoodRatings(
        @Param('id', ParseIntPipe) foodId: number,
    ) {
        return await this.foodService.getFoodRatings(foodId);
    }


    @ApiOperation({ summary: 'Tạo món ăn mới, dành cho admin/business' })
    @ApiBearerAuth()
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('manage')
    @UseInterceptors(FileInterceptor('image'))
    async createFood(
        @Req() req: Request,
        @Body() data: CreateFoodDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.foodService.createFood(
            Number(user.id),
            user.roles ?? [],
            data,
            file,
        );
    }

    @ApiOperation({ summary: 'Cập nhật món ăn, dành cho admin/business' })
    @ApiBearerAuth()
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch('manage/:id')
    @UseInterceptors(FileInterceptor('image'))
    async updateFood(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
        @Body() data: UpdateFoodDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.foodService.updateFood(
            Number(user.id),
            user.roles ?? [],
            id,
            data,
            file,
        );
    }

    @ApiOperation({ summary: 'Xóa món ăn, dành cho admin/business' })
    @ApiBearerAuth()
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete('manage/:id')
    async deleteFood(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.foodService.deleteFood(
            Number(user.id),
            user.roles ?? [],
            id,
        );
    }
}
