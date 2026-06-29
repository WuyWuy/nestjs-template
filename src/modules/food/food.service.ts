import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type { Express } from 'express';
import { Role, OrderStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CreateFoodDto, FoodQueryDto, UpdateFoodDto, CreateFoodSizeDto, CreateFoodRatingDto } from './dto/food.dto';
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
        const whereClause: any = {
            deleteAt: null,
            isAvailable: true,
            category: {
                isActive: true,
                deleteAt: null,
            },
            restaurant: {
                isActive: true,
                deleteAt: null,
                status: 'APPROVED',
            },
            name: query.name
                ? {
                      contains: query.name,
                      mode: 'insensitive',
                  }
                : undefined,
            categoryId: query.categoryId,
            restaurantId: query.restaurantId,
        };

        if (query.minPrice !== undefined) {
            whereClause.price = {
                ...whereClause.price,
                gte: query.minPrice,
            };
        }

        if (query.maxPrice !== undefined) {
            whereClause.price = {
                ...whereClause.price,
                lte: query.maxPrice,
            };
        }

        if (query.minRating !== undefined) {
            whereClause.rating = {
                ...whereClause.rating,
                gte: query.minRating,
            };
        }

        let orderByClause: any = { id: 'desc' };
        if (query.sortBy === 'PRICE_ASC') {
            orderByClause = { price: 'asc' };
        } else if (query.sortBy === 'PRICE_DESC') {
            orderByClause = { price: 'desc' };
        } else if (query.sortBy === 'RATING') {
            orderByClause = { rating: 'desc' };
        } else if (query.sortBy === 'NEWEST') {
            orderByClause = { id: 'desc' };
        }

        const foods = await this.prismaService.client.food.findMany({
            take: query.limit ?? 20,
            skip: query.offset ?? 0,
            where: whereClause,
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
                sizes: {
                    where: { deleteAt: null },
                    include: {
                        size: {
                            select: { name: true },
                        },
                    },
                },
            },
            orderBy: orderByClause,
        });

        return foods.map((food) => ({
            ...food,
            price: Number(food.price),
            sizes: food.sizes.map((s) => ({
                foodSizeId: s.id,
                sizeId: s.sizeId,
                name: s.size.name,
                price: Number(s.price),
                isDefault: s.isDefault,
            })),
        }));
    }

    async getFoodDetail(id: number) {
        const food = await this.prismaService.client.food.findFirst({
            where: {
                id,
                deleteAt: null,
                isAvailable: true,
                category: {
                    isActive: true,
                    deleteAt: null,
                },
                restaurant: {
                    isActive: true,
                    deleteAt: null,
                    status: 'APPROVED',
                },
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
                        coverImage: true,
                    },
                },
                foodIngredients: {
                    where: { deleteAt: null },
                    select: {
                        ingredient: {
                            select: { id: true, name: true, icon: true },
                        },
                    },
                },
                sizes: {
                    where: { deleteAt: null },
                    include: {
                        size: {
                            select: { name: true },
                        },
                    },
                },
            },
        });

        if (!food) throw new NotFoundException('Food not found');
        const totalQuantity = await this.prismaService.orderFood.aggregate({
            _sum: {
                quantity: true 
            }, 
            where: {
                foodId : food.id, 
                deleteAt: null, 
                order: {
                    status: OrderStatus.CONFIRMED, 
                    deleteAt: null 
                }
            }
        })
        return {
            ...food,
            totalQuantity: totalQuantity._sum.quantity || 0, 
            price: Number(food.price),
            foodIngredients: food.foodIngredients.map((ingredient) => {
                return { ...ingredient.ingredient };
            }),
            sizes: food.sizes.map((s) => ({
                foodSizeId: s.id,
                sizeId: s.sizeId,
                name: s.size.name,
                price: Number(s.price),
                isDefault: s.isDefault,
            })),
        };
    }

    private async validateAndGetDefaultSizePrice(sizes: CreateFoodSizeDto[]) {
        if (!sizes || sizes.length === 0) {
            throw new BadRequestException('At least one size is required');
        }

        const defaults = sizes.filter((s) => s.isDefault);
        if (defaults.length !== 1) {
            throw new BadRequestException('Exactly one size must be set as default');
        }

        const sizeIds = sizes.map((s) => s.sizeId);
        const uniqueSizeIds = new Set(sizeIds);
        if (uniqueSizeIds.size !== sizeIds.length) {
            throw new BadRequestException('Duplicate sizes are not allowed');
        }

        const sizesInDb = await this.prismaService.client.size.findMany({
            where: { id: { in: sizeIds } },
        });

        if (sizesInDb.length !== sizeIds.length) {
            throw new BadRequestException('One or more size IDs are invalid');
        }

        return defaults[0].price;
    }

    async createFood(
        actorId: number,
        roles: string[],
        data: CreateFoodDto,
        file?: Express.Multer.File,
    ) {
        await this.assertFoodOwner(actorId, roles, data.restaurantId);

        if (!data.sizes || data.sizes.length === 0) {
            throw new BadRequestException('Sizes are required for creating a food');
        }
        
        const defaultPrice = await this.validateAndGetDefaultSizePrice(data.sizes);

        if (data.ingredientIds) {
            await this.validateIngredientsExist(data.ingredientIds);
        }

        const foodPayload = await this.resolveFoodImagePayload(data, file);

        // Exclude sizes and ingredientIds from foodPayload for model creation
        const { sizes, ingredientIds, ...foodCreateData } = foodPayload;

        const food = await this.prismaService.client.$transaction(async (tx) => {
            const newFood = await tx.food.create({
                data: {
                    name: foodCreateData.name as string,
                    description: foodCreateData.description ?? '',
                    categoryId: foodCreateData.categoryId!,
                    price: defaultPrice,
                    image: foodCreateData.image ?? '',
                    label: foodCreateData.label ?? '',
                    restaurantId: foodCreateData.restaurantId!,
                    isAvailable: foodCreateData.isAvailable ?? true,
                },
            });

            await tx.foodSize.createMany({
                data: data.sizes!.map((s) => ({
                    foodId: newFood.id,
                    sizeId: s.sizeId,
                    price: s.price,
                    isDefault: s.isDefault ?? false,
                })),
            });

            if (data.ingredientIds && data.ingredientIds.length > 0) {
                await tx.foodIngredient.createMany({
                    data: data.ingredientIds.map((ingId) => ({
                        foodId: newFood.id,
                        ingredientId: ingId,
                    })),
                });
            }

            return newFood;
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

        let defaultPrice: number | undefined;
        if (data.sizes) {
            defaultPrice = await this.validateAndGetDefaultSizePrice(data.sizes);
        }

        if (data.ingredientIds) {
            await this.validateIngredientsExist(data.ingredientIds);
        }

        const foodPayload = await this.resolveFoodImagePayload(data, file);
        const { sizes, ingredientIds, ...updatePayload } = foodPayload;

        if (defaultPrice !== undefined) {
            updatePayload.price = defaultPrice;
        }

        const updatedFood = await this.prismaService.client.$transaction(async (tx) => {
            const result = await tx.food.update({
                where: {
                    id,
                },
                data: updatePayload,
            });

            if (data.sizes) {
                const incomingSizeIds = data.sizes.map((size) => size.sizeId);
                const removedSizes = await tx.foodSize.findMany({
                    where: {
                        foodId: id,
                        deleteAt: null,
                        sizeId: {
                            notIn: incomingSizeIds,
                        },
                    },
                    select: {
                        id: true,
                    },
                });
                const removedFoodSizeIds = removedSizes.map((size) => size.id);

                if (removedFoodSizeIds.length > 0) {
                    const deletedAt = new Date();

                    await tx.cartItem.updateMany({
                        where: {
                            foodSizeId: {
                                in: removedFoodSizeIds,
                            },
                            deleteAt: null,
                        },
                        data: {
                            deleteAt: deletedAt,
                        },
                    });

                    await tx.foodSize.updateMany({
                        where: {
                            id: {
                                in: removedFoodSizeIds,
                            },
                        },
                        data: {
                            deleteAt: deletedAt,
                            isDefault: false,
                        },
                    });
                }

                for (const size of data.sizes) {
                    await tx.foodSize.upsert({
                        where: {
                            foodId_sizeId: {
                                foodId: id,
                                sizeId: size.sizeId,
                            },
                        },
                        create: {
                            foodId: id,
                            sizeId: size.sizeId,
                            price: size.price,
                            isDefault: size.isDefault ?? false,
                        },
                        update: {
                            price: size.price,
                            isDefault: size.isDefault ?? false,
                            deleteAt: null,
                        },
                    });
                }
            }

            if (data.ingredientIds) {
                await tx.foodIngredient.deleteMany({
                    foodId: id,
                });

                for (const ingredientId of data.ingredientIds) {
                    await tx.foodIngredient.upsert({
                        where: {
                            foodId_ingredientId: {
                                foodId: id,
                                ingredientId,
                            },
                        },
                        create: {
                            foodId: id,
                            ingredientId,
                        },
                        update: {
                            deleteAt: null,
                        },
                    });
                }
            }

            return result;
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

    async getAllIngredients() {
        return await this.prismaService.client.ingredient.findMany({
            orderBy: {
                id: 'asc',
            },
        });
    }

    private async validateIngredientsExist(ingredientIds?: number[]) {
        if (!ingredientIds || ingredientIds.length === 0) return;

        const uniqueIds = Array.from(new Set(ingredientIds));
        const count = await this.prismaService.client.ingredient.count({
            where: {
                id: { in: uniqueIds },
            },
        });

        if (count !== uniqueIds.length) {
            throw new BadRequestException('One or more ingredient IDs are invalid');
        }
    }

    async createFoodRating(
        foodId: number,
        userId: number,
        data: CreateFoodRatingDto,
    ) {
        const food = await this.prismaService.client.food.findUnique({
            where: { id: foodId },
        });
        if (!food) {
            throw new NotFoundException('Food not found');
        }

        const order = await this.prismaService.client.order.findFirst({
            where: {
                id: data.orderId,
                userId,
                status: OrderStatus.CONFIRMED,
            },
            include: {
                orderFoods: true,
            },
        });

        if (!order) {
            throw new BadRequestException('You do not have a confirmed order matching this order ID');
        }

        const hasFood = order.orderFoods.some((of) => of.foodId === foodId);
        if (!hasFood) {
            throw new BadRequestException('The selected order does not contain this food item');
        }

        await this.prismaService.client.$transaction(async (tx) => {
            const existingRating = await tx.foodRating.findFirst({
                where: {
                    userId,
                    foodId,
                    orderId: data.orderId,
                    deleteAt: null,
                },
            });
            if (existingRating) {
                throw new BadRequestException('You have already rated this food item for this order');
            }

            await tx.foodRating.create({
                data: {
                    foodId,
                    userId,
                    orderId: data.orderId,
                    vote: data.vote,
                    comment: data.comment ?? '',
                },
            });

            const aggregate = await tx.foodRating.aggregate({
                where: {
                    foodId,
                    deleteAt: null,
                },
                _avg: {
                    vote: true,
                },
            });

            const average = aggregate._avg.vote ? Math.round(aggregate._avg.vote) : 0;

            await tx.food.update({
                where: { id: foodId },
                data: { rating: average },
            });
        });

        await this.auditService.log(
            'CREATE_FOOD_RATING',
            'FoodRating',
            foodId,
            userId,
            { vote: data.vote },
        );

        return {
            message: 'Food rated successfully',
        };
    }

    async getFoodRatings(foodId: number) {
        const food = await this.prismaService.client.food.findUnique({
            where: { id: foodId },
        });
        if (!food) {
            throw new NotFoundException('Food not found');
        }

        const ratings = await this.prismaService.client.foodRating.findMany({
            where: {
                foodId,
                deleteAt: null,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return ratings;
    }
}
