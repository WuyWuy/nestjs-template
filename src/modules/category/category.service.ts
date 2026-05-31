import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { Express } from 'express';
import {
    CategoryQueryDto,
    CreateCategoryDto,
    UpdateCategoryDto,
} from './dto/category.dto';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class CategoryService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly auditService: AuditService,
        private readonly minioService: MinioService,
    ) {}
    private async resolveCategoryImagePayload(
        data: Partial<CreateCategoryDto>,
        file?: Express.Multer.File,
    ) {
        let image = data.image;
        if (file) {
            image = await this.minioService.uploadFile(file);
        }

        return {
            ...data,
            image,
        };
    }

    async getCategories(query: CategoryQueryDto) {
        const categories = await this.prismaService.client.category.findMany({
            where: {
                name: query.keyword
                    ? {
                          contains: query.keyword,
                          mode: 'insensitive',
                      }
                    : undefined,
            },
            select: {
                id: true,
                name: true,
                image: true,
                description: true,
                sortOrder: true,
                foods: {
                    select: {
                        id: true,
                    },
                },
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            take: query.limit ?? 50,
            skip: query.offset ?? 0,
        });

        return categories.map((category) => ({
            ...category,
            foodCount: category.foods.length,
        }));
    }

    async getCategoryDetail(id: number) {
        const category = await this.prismaService.client.category.findFirst({
            where: {
                id,
            },
            select: {
                id: true,
                name: true,
                image: true,
                description: true,
                sortOrder: true,
                foods: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        price: true,
                        restaurant: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    take: 12,
                },
            },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        return {
            ...category,
            foods: category.foods.map((food) => ({
                ...food,
                price: Number(food.price),
            })),
        };
    }

    async createCategory(
        actorId: number,
        data: CreateCategoryDto,
        file?: Express.Multer.File,
    ) {
        const existsCategory = await this.prismaService.client.category.findFirst({
            where: {
                name: {
                    equals: data.name,
                    mode: 'insensitive',
                },
            },
        });

        if (existsCategory) {
            throw new BadRequestException('Category already exists');
        }
        const categoryPayload = await this.resolveCategoryImagePayload(
            data,
            file,
        );

        const category = await this.prismaService.client.category.create({
            data: {
                name: categoryPayload.name!,
                description: categoryPayload.description!,
                image: categoryPayload.image ?? '',
                sortOrder: categoryPayload.sortOrder ?? 0,
            },
        });

        await this.auditService.log(
            'CREATE_CATEGORY',
            'Category',
            category.id,
            actorId,
            data,
        );

        return category;
    }

    async updateCategory(
        actorId: number,
        id: number,
        data: UpdateCategoryDto,
        file?: Express.Multer.File,
    ) {
        const category = await this.prismaService.client.category.findFirst({
            where: {
                id,
            },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }
        const categoryPayload = await this.resolveCategoryImagePayload(
            data,
            file,
        );

        const updatedCategory = await this.prismaService.client.category.update({
            where: {
                id,
            },
            data: {
                ...categoryPayload,
            },
        });

        await this.auditService.log(
            'UPDATE_CATEGORY',
            'Category',
            id,
            actorId,
            data,
        );

        return updatedCategory;
    }

    async deleteCategory(actorId: number, id: number) {
        const category = await this.prismaService.client.category.findFirst({
            where: {
                id,
            },
            select: {
                id: true,
                foods: {
                    select: {
                        id: true,
                    },
                    take: 1,
                },
            },
        });

        if (!category) {
            throw new NotFoundException('Category not found');
        }

        if (category.foods.length > 0) {
            throw new BadRequestException(
                'Category still contains foods and cannot be deleted',
            );
        }

        await this.prismaService.client.category.delete({ id });

        await this.auditService.log(
            'DELETE_CATEGORY',
            'Category',
            id,
            actorId,
        );

        return {
            message: 'Category deleted successfully',
        };
    }
}
