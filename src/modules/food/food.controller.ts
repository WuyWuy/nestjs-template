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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Request } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '@/bases/decorators/role.decorators';
import { RolesGuard } from '@/bases/guards/role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FoodService } from './food.service';
import { CreateFoodDto, FoodQueryDto, UpdateFoodDto, CreateFoodRatingDto } from './dto/food.dto';

@ApiTags('07. Food')
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
    @ApiBody({
        type: CreateFoodRatingDto,
        examples: {
            example: {
                summary: 'Đánh giá món ăn',
                value: {
                    vote: 5,
                    comment: 'Món ăn ngon và giao nhanh.',
                    orderId: 1,
                },
            },
        },
    })
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
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['name', 'categoryId', 'restaurantId'],
            properties: {
                name: {
                    type: 'string',
                    example: 'Classic Cheeseburger',
                },
                description: {
                    type: 'string',
                    example: 'Beef patty, cheddar, pickles, and burger sauce.',
                },
                categoryId: {
                    type: 'number',
                    example: 1,
                },
                price: {
                    type: 'number',
                    example: 9,
                },
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh món ăn',
                },
                label: {
                    type: 'string',
                    example: 'Best seller',
                },
                restaurantId: {
                    type: 'number',
                    example: 1,
                },
                isAvailable: {
                    type: 'boolean',
                    example: true,
                },
                sizes: {
                    type: 'string',
                    example:
                        '[{"sizeId":1,"price":9,"isDefault":true},{"sizeId":2,"price":12}]',
                    description: 'JSON string khi gửi multipart/form-data',
                },
                ingredientIds: {
                    type: 'string',
                    example: '1,2,3',
                    description: 'Danh sách ingredient id, cách nhau bằng dấu phẩy',
                },
            },
        },
    })
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
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    example: 'Double Smash Burger',
                },
                description: {
                    type: 'string',
                    example: 'Two beef patties, caramelized onions, and cheddar.',
                },
                categoryId: {
                    type: 'number',
                    example: 1,
                },
                price: {
                    type: 'number',
                    example: 12,
                },
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh món ăn mới',
                },
                label: {
                    type: 'string',
                    example: 'Signature',
                },
                isAvailable: {
                    type: 'boolean',
                    example: true,
                },
                sizes: {
                    type: 'string',
                    example: '[{"sizeId":1,"price":12,"isDefault":true}]',
                },
                ingredientIds: {
                    type: 'string',
                    example: '1,2',
                },
            },
        },
    })
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
