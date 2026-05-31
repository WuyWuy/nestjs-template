import { PrismaService } from '@/prisma/prisma.service';
import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type { Express } from 'express';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CreateFoodDto, FoodQueryDto, UpdateFoodDto } from './dto/food.dto';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class FoodService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly auditService: AuditService,
        private readonly minioService: MinioService,
    ) {}

    private hasRole(roles: string[], role: Role) {
        return roles.includes(role);
    }
    private async resolveFoodImagePayload(
        data: Partial<CreateFoodDto>,
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

    private async assertFoodOwner(
        actorId: number,
        roles: string[],
        restaurantId: number,
    ) {
        if (this.hasRole(roles, Role.ADMIN)) {
            return;
        }

        const restaurant = await this.prismaService.client.restaurant.findFirst({
            where: {
                id: restaurantId,
            },
            select: {
                ownerId: true,
            },
        });

        if (!restaurant || restaurant.ownerId !== actorId) {
            throw new ForbiddenException(
                'You are not allowed to manage foods for this restaurant',
            );
        }
    }

    async getAllFood(query: FoodQueryDto) {
        const foods = await this.prismaService.client.food.findMany({
            take: query.limit ?? 20,
            skip: query.offset ?? 0,
            where: {
                name: query.name
                    ? {
                          contains: query.name,
                          mode: 'insensitive',
                      }
                    : undefined,
                categoryId: query.categoryId,
                restaurantId: query.restaurantId,
                isAvailable: true,
            },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
            orderBy: {
                id: 'desc',
            },
        });

        return foods.map((food) => ({
            ...food,
            price: Number(food.price),
        }));
    }

    async getFoodDetail(id: number) {
        const food = await this.prismaService.client.food.findFirst({
            where: { id },
            include: {
                category: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        coverImage: true,
                    },
                },
                foodIngredients: {
                    select: {
                        ingredient: {
                            select: { id: true, name: true, icon: true },
                        },
                    },
                },
            },
        });
        if (!food) throw new NotFoundException('Food not found');
        return {
            ...food,
            price: Number(food.price),
            foodIngredients: food.foodIngredients.map((ingredient) => {
                return { ...ingredient.ingredient };
            }),
        };
    }

    async createFood(
        actorId: number,
        roles: string[],
        data: CreateFoodDto,
        file?: Express.Multer.File,
    ) {
        await this.assertFoodOwner(actorId, roles, data.restaurantId);
        const foodPayload = await this.resolveFoodImagePayload(data, file);

        const food = await this.prismaService.client.food.create({
            data: {
                name: foodPayload.name,
                description: foodPayload.description ?? '',
                categoryId: foodPayload.categoryId!,
                price: foodPayload.price!,
                image: foodPayload.image ?? '',
                label: foodPayload.label ?? '',
                restaurantId: foodPayload.restaurantId!,
                isAvailable: foodPayload.isAvailable ?? true,
            },
        });

        await this.auditService.log(
            'CREATE_FOOD',
            'Food',
            food.id,
            actorId,
            data,
        );

        return food;
    }

    async updateFood(
        actorId: number,
        roles: string[],
        id: number,
        data: UpdateFoodDto,
        file?: Express.Multer.File,
    ) {
        const food = await this.prismaService.client.food.findFirst({
            where: {
                id,
            },
            select: {
                id: true,
                restaurantId: true,
            },
        });

        if (!food) {
            throw new NotFoundException('Food not found');
        }

        await this.assertFoodOwner(actorId, roles, food.restaurantId);
        const foodPayload = await this.resolveFoodImagePayload(data, file);

        const updatedFood = await this.prismaService.client.food.update({
            where: {
                id,
            },
            data: {
                ...foodPayload,
            },
        });

        await this.auditService.log(
            'UPDATE_FOOD',
            'Food',
            id,
            actorId,
            data,
        );

        return updatedFood;
    }

    async deleteFood(actorId: number, roles: string[], id: number) {
        const food = await this.prismaService.client.food.findFirst({
            where: {
                id,
            },
            select: {
                id: true,
                restaurantId: true,
            },
        });

        if (!food) {
            throw new NotFoundException('Food not found');
        }

        await this.assertFoodOwner(actorId, roles, food.restaurantId);

        await this.prismaService.client.food.delete({ id });
        await this.auditService.log('DELETE_FOOD', 'Food', id, actorId);

        return {
            message: 'Food deleted successfully',
        };
    }
}
