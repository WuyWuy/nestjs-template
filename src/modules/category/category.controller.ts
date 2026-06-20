import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Query,
    DefaultValuePipe,
    UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Role } from '@prisma/client';

// Category CRUD API
// - public GET endpoints
// - admin-only create/update/delete
@Controller('category')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    // Public endpoint: lấy danh sách danh mục sản phẩm
    @Get()
    async getCategories(
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
        @Query('name', new DefaultValuePipe('')) name: string,
    ) {
        return this.categoryService.getCategories(limit, offset, name);
    }

    @Get(':id')
    async getCategory(@Param('id', ParseIntPipe) id: number) {
        return this.categoryService.getCategory(id);
    }

    // Admin endpoint: tạo category mới
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async createCategory(@Body() dto: CreateCategoryDto) {
        return this.categoryService.createCategory(dto);
    }

    // Admin endpoint: cập nhật category
    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async updateCategory(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCategoryDto,
    ) {
        return this.categoryService.updateCategory(id, dto);
    }

    // Admin endpoint: xóa category (soft delete)
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async deleteCategory(@Param('id', ParseIntPipe) id: number) {
        return this.categoryService.deleteCategory(id);
    }
}
