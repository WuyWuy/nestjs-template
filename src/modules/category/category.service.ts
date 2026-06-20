import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';

@Injectable()
export class CategoryService {
    constructor(private readonly prismaService: PrismaService) {}

    async getCategories(limit: number, offset: number, name: string) {
        const where = {
            deleteAt: null,
            name: {
                contains: name || '',
                mode: 'insensitive',
            },
        };

        const data = await this.prismaService.category.findMany({
            where,
            take: limit,
            skip: offset,
            orderBy: { createdAt: 'desc' },
        });

        const total = await this.prismaService.category.count({ where });

        return { data, total, limit, offset };
    }

    async getCategory(id: number) {
        const category = await this.prismaService.category.findFirst({
            where: { id, deleteAt: null },
        });
        if (!category) throw new NotFoundException('Category not found');
        return category;
    }

    async createCategory(dto: CreateCategoryDto) {
        const existing = await this.prismaService.category.findFirst({
            where: { name: dto.name, deleteAt: null },
        });
        if (existing) throw new BadRequestException('Category already exists');

        return this.prismaService.category.create({ data: dto });
    }

    async updateCategory(id: number, dto: UpdateCategoryDto) {
        const category = await this.prismaService.category.findFirst({
            where: { id, deleteAt: null },
        });
        if (!category) throw new NotFoundException('Category not found');

        return this.prismaService.category.update({
            where: { id },
            data: dto,
        });
    }

    async deleteCategory(id: number) {
        const category = await this.prismaService.category.findFirst({
            where: { id, deleteAt: null },
        });
        if (!category) throw new NotFoundException('Category not found');

        return this.prismaService.category.update({
            where: { id },
            data: { deleteAt: new Date() },
        });
    }
}
