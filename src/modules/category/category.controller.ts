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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('05. Danh mục')
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
