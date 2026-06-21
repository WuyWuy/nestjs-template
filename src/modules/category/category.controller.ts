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
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Request } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '@/bases/decorators/role.decorators';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Role } from '@prisma/client';

@ApiTags('05. Category')
@Controller('categories')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @ApiOperation({ summary: 'Lấy danh sách danh mục' })
    @Get()
    async getCategories(
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
        @Query('name', new DefaultValuePipe('')) name: string,
    ) {
        return this.categoryService.getCategories(limit, offset, name);
    }

    @ApiOperation({ summary: 'Xem chi tiết một danh mục' })
    @Get(':id')
    async getCategory(@Param('id', ParseIntPipe) id: number) {
        return this.categoryService.getCategory(id);
    }

    @ApiOperation({ summary: 'Tạo danh mục mới' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['name', 'description'],
            properties: {
                name: {
                    type: 'string',
                    example: 'Burger',
                },
                description: {
                    type: 'string',
                    example: 'Smash burgers and comfort food classics.',
                },
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh danh mục',
                },
                sortOrder: {
                    type: 'number',
                    example: 1,
                },
            },
        },
    })
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async createCategory(@Body() dto: CreateCategoryDto) {
        return this.categoryService.createCategory(dto);
    }

    @ApiOperation({ summary: 'Cập nhật danh mục' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    example: 'Fast Food',
                },
                description: {
                    type: 'string',
                    example: 'Burgers, fries, and quick meals.',
                },
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh danh mục mới',
                },
                sortOrder: {
                    type: 'number',
                    example: 2,
                },
            },
        },
    })
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async updateCategory(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateCategoryDto,
    ) {
        return this.categoryService.updateCategory(id, dto);
    }

    @ApiOperation({ summary: 'Xóa danh mục' })
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    async deleteCategory(@Param('id', ParseIntPipe) id: number) {
        return this.categoryService.deleteCategory(id);
    }
}
