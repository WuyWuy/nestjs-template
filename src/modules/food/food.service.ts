import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import type { Express } from 'express';
import { MinioService } from '../minio/minio.service';
import { CreateFoodDto, UpdateFoodDto } from './dto/food.dto';

@Injectable()
export class FoodService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly minioService: MinioService,
    ) {}

    // Implementation notes:
    // - Upload-first pattern: files are uploaded to MinIO before DB writes so
    //   we can return presigned URLs immediately. On DB error we attempt to
    //   remove the uploaded object to avoid orphaned files.
    // - On update: we upload the new image (if provided), update DB, then
    //   delete the previous image. This minimizes downtime between versions.
    // - Ownership/roles: ADMIN may specify `restaurantId`; BUSINESS users are
    //   restricted to their own restaurant (enforced in resolveRestaurantForCreate
    //   and getManagedFoodOrThrow). Review these checks when changing role names.

    async getAllFood(limit: number, offset: number, name: string) {
        try {
            const foods = await this.prismaService.client.food.findMany({
                take: limit,
                skip: offset,
                where: {
                    name: {
                        contains: name,
                        mode: 'insensitive',
                    },
                },
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            return await Promise.all(
                foods.map(async (food) => ({
                    ...food,
                    image: await this.resolveImage(food.image),
                })),
            );
        } catch (err) {
            console.log('Get all food error: ', err);
            throw err;
        }
    }

    async getFoodDetail(id: number) {
        try {
            const food = await this.prismaService.client.food.findFirst({
                where: { id },
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
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
                image: await this.resolveImage(food.image),
                foodIngredients: food.foodIngredients.map((ingredient) => {
                    return { ...ingredient.ingredient };
                }),
            };
        } catch (err) {
            console.log('Get food detail error', err);
            throw err;
        }
    }

    async getFoodsByRestaurantId(
        restaurantId: number,
        limit: number,
        offset: number,
    ) {
        try {
            const foods = await this.prismaService.client.food.findMany({
                where: {
                    restaurantId,
                    deleteAt: null,
                },
                take: limit,
                skip: offset,
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            return await Promise.all(
                foods.map(async (food) => ({
                    ...food,
                    image: await this.resolveImage(food.image),
                })),
            );
        } catch (err) {
            console.log('Get foods by restaurant error: ', err);
            throw err;
        }
    }

    async createFood(
        userId: number,
        role: Role | undefined,
        data: CreateFoodDto,
        file?: Express.Multer.File,
    ) {
        // uploadedImage stores the MinIO object name. If an error occurs after
        // upload we will delete this object to avoid leaking storage.
        let uploadedImage = '';
        try {
            if (!file) throw new BadRequestException('Image is required');
            // Upload image to MinIO. `file.buffer` is expected (hence memoryStorage).
            uploadedImage = await this.minioService.uploadFile(file);
            const restaurant = await this.resolveRestaurantForCreate(
                userId,
                role,
                data.restaurantId,
            );

            const createdFood = await this.prismaService.transaction(async (tx) => {
                return await tx.food.create({
                    data: {
                        name: data.name,
                        description: data.description ?? '',
                        categoryId: data.categoryId,
                        price: new Prisma.Decimal(data.price),
                        image: uploadedImage,
                        label: data.label ?? '',
                        restaurantId: restaurant.id,
                    },
                });
            });

            return {
                ...createdFood,
                image: await this.resolveImage(createdFood.image),
            };
        } catch (err) {
            // Cleanup uploaded image on error to avoid orphan files.
            if (uploadedImage) {
                await this.safeDeleteFile(uploadedImage);
            }
            console.log('Create food error', err);
            throw err;
        }
    }

    async updateFood(
        userId: number,
        role: Role | undefined,
        foodId: number,
        data: UpdateFoodDto,
        file?: Express.Multer.File,
    ) {
        let uploadedImage = '';
        try {
            const currentFood = await this.getManagedFoodOrThrow(
                userId,
                role,
                foodId,
            );

            if (role === Role.BUSINESS && data.restaurantId) {
                if (data.restaurantId !== currentFood.restaurant.id) {
                    throw new ForbiddenException(
                        'You can only update food in your own restaurant',
                    );
                }
            }

            if (role === Role.ADMIN && data.restaurantId) {
                const targetRestaurant =
                    await this.prismaService.client.restaurant.findFirst({
                        where: { id: data.restaurantId, deleteAt: null },
                        select: { id: true },
                    });
                if (!targetRestaurant) {
                    throw new NotFoundException('Restaurant not found');
                }
            }

            // If an image file is provided, upload first then update DB.
            if (file) {
                uploadedImage = await this.minioService.uploadFile(file);
            }

            const nextImage = uploadedImage || currentFood.image;

            const updatedFood = await this.prismaService.transaction(async (tx) => {
                return await tx.food.update({
                    where: { id: foodId },
                    data: {
                        name: data.name,
                        description: data.description,
                        categoryId: data.categoryId,
                        price:
                            data.price !== undefined
                                ? new Prisma.Decimal(data.price)
                                : undefined,
                        image: nextImage,
                        label: data.label,
                        ...(role === Role.ADMIN && data.restaurantId
                            ? { restaurantId: data.restaurantId }
                            : {}),
                    },
                });
            });

            // After successful DB update, delete old image if we replaced it.
            if (uploadedImage && currentFood.image) {
                await this.safeDeleteFile(currentFood.image);
            }

            return {
                ...updatedFood,
                image: await this.resolveImage(updatedFood.image),
            };
        } catch (err) {
            // If update failed after uploading a new image, remove the new object
            // so we don't leave unused files in the bucket.
            if (uploadedImage) {
                await this.safeDeleteFile(uploadedImage);
            }
            console.log('Update food error', err);
            throw err;
        }
    }

    async deleteFood(userId: number, role: Role | undefined, foodId: number) {
        try {
            const currentFood = await this.getManagedFoodOrThrow(
                userId,
                role,
                foodId,
            );

            await this.prismaService.transaction(async (tx) => {
                await tx.food.delete({ id: currentFood.id });
            });

            if (currentFood.image) {
                await this.safeDeleteFile(currentFood.image);
            }

            return { success: true };
        } catch (err) {
            console.log('Delete food error', err);
            throw err;
        }
    }

    private async resolveRestaurantForCreate(
        userId: number,
        role: Role | undefined,
        restaurantId?: number,
    ) {
        if (role === Role.ADMIN) {
            if (!restaurantId) {
                throw new BadRequestException('restaurantId is required for admin');
            }

            const targetRestaurant =
                await this.prismaService.client.restaurant.findFirst({
                    where: { id: restaurantId, deleteAt: null },
                    select: { id: true },
                });

            if (!targetRestaurant) {
                throw new NotFoundException('Restaurant not found');
            }

            return targetRestaurant;
        }

        const ownRestaurant = await this.prismaService.client.restaurant.findFirst({
            where: { ownerId: userId, deleteAt: null },
            select: { id: true },
        });

        if (!ownRestaurant) {
            throw new NotFoundException('Restaurant not found for current user');
        }

        if (restaurantId && ownRestaurant.id !== restaurantId) {
            throw new ForbiddenException('You can only create food for your restaurant');
        }

        return ownRestaurant;
    }

    private async getManagedFoodOrThrow(
        userId: number,
        role: Role | undefined,
        foodId: number,
    ) {
        if (role === Role.ADMIN) {
            const food = await this.prismaService.client.food.findFirst({
                where: { id: foodId, deleteAt: null },
                include: {
                    restaurant: {
                        select: { id: true, ownerId: true },
                    },
                },
            });

            if (!food) throw new NotFoundException('Food not found');

            return food;
        }

        const food = await this.prismaService.client.food.findFirst({
            where: {
                id: foodId,
                deleteAt: null,
                restaurant: {
                    is: {
                        ownerId: userId,
                        deleteAt: null,
                    },
                },
            },
            include: {
                restaurant: {
                    select: { id: true, ownerId: true },
                },
            },
        });

        if (!food) throw new NotFoundException('Food not found');

        return food;
    }

    private async resolveImage(image: string) {
        if (!image) return '';
        if (/^https?:\/\//i.test(image)) return image;
        return await this.minioService.getFileUrl(image);
    }

    private async safeDeleteFile(fileName: string) {
        try {
            await this.minioService.deleteFile(fileName);
        } catch (err) {
            console.log('Delete food image error', err);
        }
    }
}