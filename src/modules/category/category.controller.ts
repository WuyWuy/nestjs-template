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
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Request } from 'express';
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

@ApiTags('05. Category')
@Controller('categories')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @ApiOperation({ summary: 'Lấy danh sách danh mục' })
    @Get()
    async getCategories(@Query() query: CategoryQueryDto) {
        return await this.categoryService.getCategories(query);
    }

    @ApiOperation({ summary: 'Xem chi tiết một danh mục' })
    @Get(':id')
    async getCategoryDetail(@Param('id', ParseIntPipe) id: number) {
        return await this.categoryService.getCategoryDetail(id);
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
    @UseInterceptors(FileInterceptor('image'))
    async createCategory(
        @Req() req: Request,
        @Body() data: CreateCategoryDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.categoryService.createCategory(actorId, data, file);
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
    @Patch(':id')
    @UseInterceptors(FileInterceptor('image'))
    async updateCategory(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
        @Body() data: UpdateCategoryDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.categoryService.updateCategory(
            actorId,
            id,
            data,
            file,
        );
    }

    @ApiOperation({ summary: 'Xóa danh mục' })
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
