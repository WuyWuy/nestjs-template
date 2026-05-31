import { PrismaService } from '@/prisma/prisma.service';
import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CreateFoodDto, FoodQueryDto, UpdateFoodDto } from './dto/food.dto';

@Injectable()
export class FoodService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly auditService: AuditService,
    ) {}

    private hasRole(roles: string[], role: Role) {
        return roles.includes(role);
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

    async createFood(actorId: number, roles: string[], data: CreateFoodDto) {
        await this.assertFoodOwner(actorId, roles, data.restaurantId);

        const food = await this.prismaService.client.food.create({
            data: {
                name: data.name,
                description: data.description ?? '',
                categoryId: data.categoryId,
                price: data.price,
                image: data.image ?? '',
                label: data.label ?? '',
                restaurantId: data.restaurantId,
                isAvailable: data.isAvailable ?? true,
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

        const updatedFood = await this.prismaService.client.food.update({
            where: {
                id,
            },
            data: {
                ...data,
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
