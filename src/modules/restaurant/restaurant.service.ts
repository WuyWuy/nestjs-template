import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import {
    CreateRestaurantDto,
    CreateRestaurantRatingDto,
    UpdateRestaurantDto,
} from './dto/restaurant.dto';
import { AuditService } from '../audit/audit.service';
import { MinioService } from '../minio/minio.service';
import type { Express } from 'express';

type RestaurantUploadFiles = {
    image?: Express.Multer.File[];
    coverImage?: Express.Multer.File[];
};

@Injectable()
export class RestaurantService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly auditService: AuditService,
        private readonly minioService: MinioService,
    ) {}
    private buildRestaurantSummary<T extends { ratings: { vote: number }[] }>(
        restaurant: T,
    ) {
        const ratingCount = restaurant.ratings.length;
        const averageRating = ratingCount
            ? Number(
                  (
                      restaurant.ratings.reduce(
                          (sum, rating) => sum + rating.vote,
                          0,
                      ) / ratingCount
                  ).toFixed(1),
              )
            : 0;

        return {
            averageRating,
            ratingCount,
        };
    }

    private hasRole(roles: string[], role: Role) {
        return roles.includes(role);
    }
    private async resolveRestaurantImagePayload<T extends Partial<CreateRestaurantDto>>(
        data: T,
        files?: RestaurantUploadFiles,
    ): Promise<T & { image?: string; coverImage?: string }> {
        let image = data.image;
        let coverImage = data.coverImage;

        const imageFile = files?.image?.[0];
        const coverImageFile = files?.coverImage?.[0];

        if (imageFile) {
            image = await this.minioService.uploadFile(imageFile);
        }

        if (coverImageFile) {
            coverImage = await this.minioService.uploadFile(coverImageFile);
        }

        return {
            ...data,
            image,
            coverImage,
        };
    }

    private async assertRestaurantOwner(
        actorId: number,
        roles: string[],
        restaurantId: number,
    ) {
        const restaurant = await this.prismaService.client.restaurant.findFirst({
            where: {
                id: restaurantId,
            },
            select: {
                id: true,
                ownerId: true,
            },
        });

        if (!restaurant) {
            throw new NotFoundException('Restaurant not found');
        }

        if (this.hasRole(roles, Role.ADMIN)) {
            return;
        }

        if (restaurant.ownerId !== actorId) {
            throw new ForbiddenException(
                'You are not allowed to manage this restaurant',
            );
        }
    }

    private async assertAddressExists(addressId: number) {
        const address = await this.prismaService.client.address.findFirst({
            where: {
                id: addressId,
            },
            select: {
                id: true,
            },
        });

        if (!address) {
            throw new BadRequestException('Address not found');
        }
    }

    async getAllRestaurants(
        limit: number,
        offset: number,
        keyword: string,
        categoryId?: number,
    ) {
        try {
            const restaurants = await this.prismaService.client.restaurant.findMany(
                {
                    where: {
                        approved: true,
                        OR: keyword
                            ? [
                                  {
                                      name: {
                                          contains: keyword,
                                          mode: 'insensitive',
                                      },
                                  },
                                  {
                                      foods: {
                                          some: {
                                              name: {
                                                  contains: keyword,
                                                  mode: 'insensitive',
                                              },
                                          },
                                      },
                                  },
                              ]
                            : undefined,
                        foods: categoryId
                            ? {
                                  some: {
                                      categoryId,
                                  },
                              }
                            : undefined,
                    },
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        coverImage: true,
                        description: true,
                        phone: true,
                        deliveryFee: true,
                        minimumOrder: true,
                        estimatedDeliveryTime: true,
                        address: {
                            select: {
                                id: true,
                                title: true,
                                fullText: true,
                            },
                        },
                        foods: {
                            select: {
                                id: true,
                                price: true,
                                category: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                            },
                            take: 8,
                        },
                        ratings: {
                            select: {
                                vote: true,
                            },
                        },
                    },
                    take: limit,
                    skip: offset,
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            );

            return restaurants.map((restaurant) => {
                const { averageRating, ratingCount } =
                    this.buildRestaurantSummary(restaurant);

                return {
                    id: restaurant.id,
                    name: restaurant.name,
                    image: restaurant.image,
                    coverImage: restaurant.coverImage,
                    description: restaurant.description,
                    phone: restaurant.phone,
                    deliveryFee: Number(restaurant.deliveryFee),
                    minimumOrder: Number(restaurant.minimumOrder),
                    estimatedDeliveryTime: restaurant.estimatedDeliveryTime,
                    address: restaurant.address,
                    averageRating,
                    ratingCount,
                    categories: Array.from(
                        new Map(
                            restaurant.foods.map((food) => [
                                food.category.id,
                                food.category,
                            ]),
                        ).values(),
                    ),
                    startingPrice:
                        restaurant.foods.length > 0
                            ? Number(
                                  restaurant.foods.reduce((min, food) => {
                                      return food.price.lessThan(min)
                                          ? food.price
                                          : min;
                                  }, restaurant.foods[0].price),
                              )
                            : 0,
                };
            });
        } catch (err) {
            console.log("get all restaurant error: " , err) 
            throw err;
        }
    }

    async getRestaurantMenu(
        restaurantId: number,
        keyword: string,
        categoryId?: number,
    ) {
        try {
            const restaurant = await this.prismaService.client.restaurant.findFirst(
                {
                    where: {
                        id: restaurantId,
                        approved: true,
                    },
                    select: {
                        id: true,
                        name: true,
                        foods: {
                            where: {
                                name: keyword
                                    ? {
                                          contains: keyword,
                                          mode: 'insensitive',
                                      }
                                    : undefined,
                                categoryId,
                            },
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                image: true,
                                label: true,
                                price: true,
                                rating: true,
                                category: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                            },
                            orderBy: {
                                id: 'asc',
                            },
                        },
                    },
                },
            );

            if (!restaurant) throw new NotFoundException('Restaurant not found');

            return {
                id: restaurant.id,
                name: restaurant.name,
                foods: restaurant.foods,
            };
        } catch (err) {
            console.log("Get restaurant menu error: " , err) 
            throw err;
        }
    }

    async getRestaurantInDetail(restaurantId: number) {
        try {
            const restaurant = await this.prismaService.client.restaurant.findFirst(
                {
                    where: {
                        id: restaurantId,
                        approved: true,
                    },
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        coverImage: true,
                        phone: true,
                        description: true,
                        deliveryFee: true,
                        minimumOrder: true,
                        estimatedDeliveryTime: true,
                        address: true,
                        ownerId: true,
                        foods: {
                            select: {
                                id: true,
                                name: true,
                                price: true,
                                image: true,
                                label: true,
                                category: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                            },
                            take: 12,
                        },
                        ratings: {
                            where: {
                                deleteAt: null,
                            },
                            select: {
                                id: true,
                                vote: true,
                                comment: true,
                                createdAt: true,
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
                            take: 5,
                        },
                    },
                },
            );
            if (!restaurant) throw new NotFoundException('restaurant not found');

            const { averageRating, ratingCount } =
                this.buildRestaurantSummary(restaurant);

            return {
                ...restaurant,
                deliveryFee: Number(restaurant.deliveryFee),
                minimumOrder: Number(restaurant.minimumOrder),
                averageRating,
                ratingCount,
                categories: Array.from(
                    new Map(
                        restaurant.foods.map((food) => [
                            food.category.id,
                            food.category,
                        ]),
                    ).values(),
                ),
            };
        } catch (err) {
            console.log("Get all restaurants error: " , err)  
            throw err;
        }
    }

    async createRestaurantRating(
        restaurantId: number,
        userId: number,
        data: CreateRestaurantRatingDto,
    ) {
        try {
            const restaurant = await this.prismaService.client.restaurant.findFirst(
                {
                    where: {
                        id: restaurantId,
                        approved: true,
                    },
                },
            );

            if (!restaurant) {
                throw new NotFoundException('Restaurant not found');
            }

            const existingRating =
                await this.prismaService.client.restaurantRating.findFirst({
                    where: {
                        restaurantId,
                        userId,
                    },
                });

            if (existingRating) {
                return await this.prismaService.client.restaurantRating.update({
                    where: {
                        id: existingRating.id,
                    },
                    data: {
                        vote: data.vote,
                        comment: data.comment ?? '',
                    },
                });
            }

            return await this.prismaService.client.restaurantRating.create({
                data: {
                    restaurantId,
                    userId,
                    vote: data.vote,
                    comment: data.comment ?? '',
                },
            });
        } catch (err) {
            console.log("Creating restaurant err: " , err) 
            throw err;
        }
    }

    async getRestaurantRatings(restaurantId: number) {
        const restaurant = await this.prismaService.client.restaurant.findFirst({
            where: {
                id: restaurantId,
                approved: true,
            },
            select: {
                id: true,
                name: true,
                ratings: {
                    select: {
                        id: true,
                        vote: true,
                        comment: true,
                        createdAt: true,
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
                },
            },
        });

        if (!restaurant) {
            throw new BadRequestException('Restaurant not found');
        }

        const { averageRating, ratingCount } =
            this.buildRestaurantSummary(restaurant);

        return {
            id: restaurant.id,
            name: restaurant.name,
            averageRating,
            ratingCount,
            ratings: restaurant.ratings,
        };
    }

    async getMyRestaurants(actorId: number, roles: string[]) {
        const restaurants = await this.prismaService.client.restaurant.findMany({
            where: this.hasRole(roles, Role.ADMIN)
                ? undefined
                : {
                      ownerId: actorId,
                  },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return restaurants.map((restaurant) => ({
            ...restaurant,
            deliveryFee: Number(restaurant.deliveryFee),
            minimumOrder: Number(restaurant.minimumOrder),
        }));
    }

    async createRestaurant(
        actorId: number,
        data: CreateRestaurantDto,
        roles: string[],
        files?: RestaurantUploadFiles,
    ) {
        if (!this.hasRole(roles, Role.ADMIN) && !this.hasRole(roles, Role.BUSINESS)) {
            throw new ForbiddenException('Only business/admin can create restaurants');
        }

        const restaurantPayload = await this.resolveRestaurantImagePayload(
            data,
            files,
        );

        await this.assertAddressExists(restaurantPayload.addressId);

        const createData: Prisma.RestaurantUncheckedCreateInput = {
            name: restaurantPayload.name,
            phone: restaurantPayload.phone,
            addressId: restaurantPayload.addressId,
            description: restaurantPayload.description ?? '',
            image: restaurantPayload.image ?? '',
            coverImage: restaurantPayload.coverImage ?? '',
            deliveryFee: restaurantPayload.deliveryFee ?? 0,
            minimumOrder: restaurantPayload.minimumOrder ?? 0,
            estimatedDeliveryTime:
                restaurantPayload.estimatedDeliveryTime ?? 20,
            ownerId: actorId,
            approved: this.hasRole(roles, Role.ADMIN),
        };

        const restaurant = await this.prismaService.client.restaurant.create({
            data: createData,
        });

        await this.auditService.log(
            'CREATE_RESTAURANT',
            'Restaurant',
            restaurant.id,
            actorId,
            data,
        );

        return restaurant;
    }

    async updateRestaurant(
        actorId: number,
        roles: string[],
        restaurantId: number,
        data: UpdateRestaurantDto,
        files?: RestaurantUploadFiles,
    ) {
        await this.assertRestaurantOwner(actorId, roles, restaurantId);

        const restaurantPayload = await this.resolveRestaurantImagePayload(
            data,
            files,
        );

        if (restaurantPayload.addressId !== undefined) {
            await this.assertAddressExists(restaurantPayload.addressId);
        }

        const updateData: Prisma.RestaurantUncheckedUpdateInput = {};

        if (restaurantPayload.name !== undefined) {
            updateData.name = restaurantPayload.name;
        }
        if (restaurantPayload.phone !== undefined) {
            updateData.phone = restaurantPayload.phone;
        }
        if (restaurantPayload.addressId !== undefined) {
            updateData.addressId = restaurantPayload.addressId;
        }
        if (restaurantPayload.description !== undefined) {
            updateData.description = restaurantPayload.description;
        }
        if (restaurantPayload.image !== undefined) {
            updateData.image = restaurantPayload.image;
        }
        if (restaurantPayload.coverImage !== undefined) {
            updateData.coverImage = restaurantPayload.coverImage;
        }
        if (restaurantPayload.deliveryFee !== undefined) {
            updateData.deliveryFee = restaurantPayload.deliveryFee;
        }
        if (restaurantPayload.minimumOrder !== undefined) {
            updateData.minimumOrder = restaurantPayload.minimumOrder;
        }
        if (restaurantPayload.estimatedDeliveryTime !== undefined) {
            updateData.estimatedDeliveryTime =
                restaurantPayload.estimatedDeliveryTime;
        }

        if (!Object.keys(updateData).length) {
            throw new BadRequestException(
                'No valid restaurant data provided for update',
            );
        }

        const restaurant = await this.prismaService.client.restaurant.update({
            where: {
                id: restaurantId,
            },
            data: updateData,
        });

        await this.auditService.log(
            'UPDATE_RESTAURANT',
            'Restaurant',
            restaurantId,
            actorId,
            data,
        );

        return restaurant;
    }
}
