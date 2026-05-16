import {
    Body,
    Controller,
    DefaultValuePipe,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Req,
    UnauthorizedException,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Request } from 'express';
import { memoryStorage } from 'multer';
import { Role } from '@prisma/client';
import { Roles } from '@/bases/decorators/role.decorators';
import { RolesGuard } from '@/bases/guards/role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateFoodDto, UpdateFoodDto } from './dto/food.dto';
import { FoodService } from './food.service';

@Controller('food')
export class FoodController {
    constructor(private readonly foodService: FoodService) {}

    // NOTE FOR REVIEWERS / FE:
    // - Create/Update endpoints expect `multipart/form-data`.
    // - `image` field must be a file. We use `memoryStorage()` so the file
    //   buffer is available to `MinioService.uploadFile()` (MinIO client expects a Buffer).
    // - Authentication: Create/Update/Delete are guarded with `JwtAuthGuard` + `RolesGuard`.
    //   The `accessToken` must include `roles` (e.g., ["BUSINESS"] or ["ADMIN"]).
    // - Admins can set `restaurantId` when creating/updating; BUSINESS users are
    //   limited to their own restaurant (ownership enforced in service).

    @Get()
    async getAllFood(
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
        @Query('name', new DefaultValuePipe('')) name: string,
    ) {
        return await this.foodService.getAllFood(limit, offset, name);
    }

    @Get('/:id')
    async getFoodDetail(@Param('id', ParseIntPipe) id: number) {
        return await this.foodService.getFoodDetail(id);
    }

    @Get('restaurant/:restaurantId')
    async getFoodsByRestaurantId(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    ) {
        return await this.foodService.getFoodsByRestaurantId(
            restaurantId,
            limit,
            offset,
        );
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
    async createFood(
        @Req() req: Request,
        @Body() data: CreateFoodDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const user = req.user as any;
        const userId = user?.id;
        const role = this.resolveManageRole(user);

        if (!userId || Number.isNaN(Number(userId))) {
            throw new UnauthorizedException('Invalid token');
        }

        return await this.foodService.createFood(Number(userId), role, data, file);
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch('/:id')
    @UseInterceptors(FileInterceptor('image', { storage: memoryStorage() }))
    async updateFood(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
        @Body() data: UpdateFoodDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const user = req.user as any;
        const userId = user?.id;
        const role = this.resolveManageRole(user);

        if (!userId || Number.isNaN(Number(userId))) {
            throw new UnauthorizedException('Invalid token');
        }

        return await this.foodService.updateFood(
            Number(userId),
            role,
            id,
            data,
            file,
        );
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete('/:id')
    async deleteFood(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
    ) {
        const user = req.user as any;
        const userId = user?.id;
        const role = this.resolveManageRole(user);

        if (!userId || Number.isNaN(Number(userId))) {
            throw new UnauthorizedException('Invalid token');
        }

        return await this.foodService.deleteFood(Number(userId), role, id);
    }

    private resolveManageRole(user: any): Role | undefined {
        if (user?.roles?.includes(Role.ADMIN)) {
            return Role.ADMIN;
        }
        if (user?.roles?.includes(Role.BUSINESS)) {
            return Role.BUSINESS;
        }
        return undefined;
    }
}
