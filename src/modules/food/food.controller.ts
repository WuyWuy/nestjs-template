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
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Request } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '@/bases/decorators/role.decorators';
import { RolesGuard } from '@/bases/guards/role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FoodService } from './food.service';
import { CreateFoodDto, FoodQueryDto, UpdateFoodDto } from './dto/food.dto';

@Controller('food')
export class FoodController {
    constructor(private readonly foodService: FoodService) {}

    @Get()
    async getAllFood(@Query() query: FoodQueryDto) {
        return await this.foodService.getAllFood(query);
    }

    @Get('/:id')
    async getFoodDetail(@Param('id', ParseIntPipe) id: number) {
        return await this.foodService.getFoodDetail(id);
    }

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
