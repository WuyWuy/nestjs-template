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
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '@/bases/decorators/role.decorators';
import { RolesGuard } from '@/bases/guards/role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CategoryService } from './category.service';
import {
    CategoryQueryDto,
    CreateCategoryDto,
    UpdateCategoryDto,
} from './dto/category.dto';

@Controller('categories')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @Get()
    async getCategories(@Query() query: CategoryQueryDto) {
        return await this.categoryService.getCategories(query);
    }

    @Get(':id')
    async getCategoryDetail(@Param('id', ParseIntPipe) id: number) {
        return await this.categoryService.getCategoryDetail(id);
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    async createCategory(@Req() req: Request, @Body() data: CreateCategoryDto) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.categoryService.createCategory(actorId, data);
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id')
    async updateCategory(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
        @Body() data: UpdateCategoryDto,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.categoryService.updateCategory(actorId, id, data);
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete(':id')
    async deleteCategory(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.categoryService.deleteCategory(actorId, id);
    }
}
