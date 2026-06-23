import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, OrderStatus, NotificationType } from '@prisma/client';
import {
    CreateRestaurantDto,
    CreateRestaurantRatingDto,
    UpdateRestaurantDto,
    ALLOWED_REVIEW_TAGS,
    UpdateRestaurantRatingDto,
} from './dto/restaurant.dto';
import { AuditService } from '../audit/audit.service';
import { MinioService } from '../minio/minio.service';
import type { Express } from 'express';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEvent } from '../notification/events/notification.event';

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
        private readonly eventEmitter: EventEmitter2,
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

    public calculateDistance(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ): number {
        const R = 6371; // Earth radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
                Math.cos((lat2 * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    async getAllRestaurants(
        limit: number,
        offset: number,
        keyword: string,
        categoryId?: number,
        latitude?: number,
        longitude?: number,
        minRating?: number,
        sortBy?: string,
        userId?: number,
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
                        minimumOrder: true,
                        estimatedDeliveryTime: true,
                        createdAt: true,
                        address: {
                            select: {
                                id: true,
                                title: true,
                                fullText: true,
                                latitude: true,
                                longitude: true,
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
                },
            );

            let mapped = restaurants.map((restaurant) => {
                const { averageRating, ratingCount } =
                    this.buildRestaurantSummary(restaurant);

                let distanceKm: number | null = null;
                if (
                    latitude !== undefined &&
                    longitude !== undefined &&
                    restaurant.address?.latitude !== null &&
                    restaurant.address?.longitude !== null &&
                    restaurant.address?.latitude !== undefined &&
                    restaurant.address?.longitude !== undefined
                ) {
                    const dist = this.calculateDistance(
                        latitude,
                        longitude,
                        restaurant.address.latitude,
                        restaurant.address.longitude,
                    );
                    distanceKm = Math.round(dist * 100) / 100;
                }

                return {
                    id: restaurant.id,
                    name: restaurant.name,
                    image: restaurant.image,
                    coverImage: restaurant.coverImage,
                    description: restaurant.description,
                    phone: restaurant.phone,
                    minimumOrder: Number(restaurant.minimumOrder),
                    estimatedDeliveryTime: restaurant.estimatedDeliveryTime,
                    createdAt: restaurant.createdAt,
                    address: restaurant.address,
                    averageRating,
                    ratingCount,
                    distanceKm,
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

            if (minRating !== undefined) {
                mapped = mapped.filter((r) => r.averageRating >= minRating);
            }

            if (sortBy === 'DISTANCE' && latitude !== undefined && longitude !== undefined) {
                mapped.sort((a, b) => {
                    if (a.distanceKm === null) return 1;
                    if (b.distanceKm === null) return -1;
                    return a.distanceKm - b.distanceKm;
                });
            } else if (sortBy === 'RATING') {
                mapped.sort((a, b) => b.averageRating - a.averageRating);
            } else {
                mapped.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            }

            const paginated = mapped.slice(offset, offset + limit);

            const restaurantIds = paginated.map((r) => r.id);
            const userFavorites = userId
                ? await this.prismaService.client.userFavoriteRestaurant.findMany({
                      where: {
                          userId,
                          restaurantId: { in: restaurantIds },
                      },
                      select: { restaurantId: true },
                  })
                : [];
            const favoriteSet = new Set(userFavorites.map((f) => f.restaurantId));

            return paginated.map(({ createdAt, ...rest }) => ({
                ...rest,
                isLiked: favoriteSet.has(rest.id),
            }));
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
                        minimumOrder: true,
                        estimatedDeliveryTime: true,
                        isOpen: true,
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
                                reply: true,
                                replyCreatedAt: true,
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

            const order = await this.prismaService.client.order.findFirst({
                where: {
                    id: data.orderId,
                },
            });

            if (!order) {
                throw new NotFoundException('Order not found');
            }

            if (order.userId !== userId) {
                throw new ForbiddenException('You do not have permission to rate this order');
            }

            if (order.restaurantId !== restaurantId) {
                throw new BadRequestException('This order does not belong to the specified restaurant');
            }

            if (order.status !== 'DELIVERED') {
                throw new BadRequestException('Only delivered orders can be rated');
            }

            const existingRating = await this.prismaService.client.restaurantRating.findFirst({
                where: {
                    orderId: data.orderId,
                },
            });

            if (existingRating) {
                throw new BadRequestException('This order has already been rated');
            }

            if (data.tags && data.tags.length > 0) {
                const invalidTags = data.tags.filter(t => !ALLOWED_REVIEW_TAGS.includes(t));
                if (invalidTags.length > 0) {
                    throw new BadRequestException('Invalid review tags');
                }
            }

            const rating = await this.prismaService.client.restaurantRating.create({
                data: {
                    restaurantId,
                    userId,
                    vote: data.vote,
                    comment: data.comment ?? '',
                    orderId: data.orderId,
                    tags: data.tags ?? undefined,
                },
            });

            try {
                this.eventEmitter.emit('notification.send', {
                    recipientUserId: restaurant.ownerId,
                    title: 'New Restaurant Review',
                    body: `A customer has rated your restaurant "${restaurant.name}" with ${data.vote} stars: "${data.comment ?? ''}"`,
                    type: NotificationType.SYSTEM,
                    targetType: 'RESTAURANT',
                    targetId: restaurantId,
                    actorId: userId,
                    metadata: {
                        ratingId: rating.id,
                        vote: data.vote,
                        comment: data.comment ?? '',
                    },
                } as NotificationEvent);
            } catch (err) {
                console.error('Error emitting review notification:', err);
            }

            return rating;
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
                        reply: true,
                        replyCreatedAt: true,
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

    async getRestaurantDashboard(
        restaurantId: number,
        actorId: number,
        roles: string[],
        range: 'day' | 'week' | 'month',
    ) {
        await this.assertRestaurantOwner(actorId, roles, restaurantId);

        const startDate = new Date();
        if (range === 'day') {
            startDate.setHours(0, 0, 0, 0);
        } else if (range === 'week') {
            startDate.setDate(startDate.getDate() - 7);
            startDate.setHours(0, 0, 0, 0);
        } else if (range === 'month') {
            startDate.setDate(startDate.getDate() - 30);
            startDate.setHours(0, 0, 0, 0);
        } else {
            throw new BadRequestException('Invalid dashboard range');
        }

        const orders = await this.prismaService.client.order.findMany({
            where: {
                restaurantId,
                payments: {
                    some: {
                        createdAt: {
                            gte: startDate,
                        },
                    },
                },
            },
            include: {
                payments: true,
                orderFoods: {
                    include: {
                        food: true,
                    },
                },
            },
        });

        let deliveredRevenue = 0;
        let deliveredOrderCount = 0;
        let cancelledOrderCount = 0;

        const foodStats = new Map<number, { id: number; name: string; image: string; quantity: number; revenue: number }>();

        for (const order of orders) {
            if (order.status === OrderStatus.DELIVERED) {
                deliveredOrderCount++;
                deliveredRevenue += Number(order.totalPrice);

                for (const orderFood of order.orderFoods) {
                    const quantity = orderFood.quantity;
                    const revenue = Number(orderFood.price);
                    const foodId = orderFood.foodId;
                    const existing = foodStats.get(foodId);

                    if (existing) {
                        existing.quantity += quantity;
                        existing.revenue += revenue;
                    } else {
                        foodStats.set(foodId, {
                            id: foodId,
                            name: orderFood.food?.name ?? `Food #${foodId}`,
                            image: orderFood.food?.image ?? '',
                            quantity,
                            revenue,
                        });
                    }
                }
            } else if (order.status === OrderStatus.CANCELLED) {
                cancelledOrderCount++;
            }
        }

        const topFoods = Array.from(foodStats.values())
            .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
            .slice(0, 5);

        return {
            deliveredRevenue,
            deliveredOrderCount,
            cancelledOrderCount,
            topFoods,
        };
    }

    async getRestaurantRevenue(
        restaurantId: number,
        actorId: number,
        roles: string[],
    ) {
        await this.assertRestaurantOwner(actorId, roles, restaurantId);

        const ordersAggregate = await this.prismaService.client.order.aggregate({
            where: {
                restaurantId,
                status: OrderStatus.DELIVERED,
            },
            _sum: {
                totalPrice: true,
            },
        });

        const grossRevenue = Number(ordersAggregate._sum.totalPrice ?? 0);
        const platformCommissionRate = 0.2;
        const platformCommission = Number((grossRevenue * platformCommissionRate).toFixed(2));
        const restaurantNetRevenue = Number((grossRevenue * 0.8).toFixed(2));

        await this.auditService.log(
            'VIEW_RESTAURANT_REVENUE',
            'Restaurant',
            restaurantId,
            actorId,
        );

        return {
            grossRevenue,
            platformCommissionRate,
            platformCommission,
            restaurantNetRevenue,
        };
    }

    async updateRestaurantStatus(
        restaurantId: number,
        actorId: number,
        roles: string[],
        isOpen: boolean,
    ) {
        await this.assertRestaurantOwner(actorId, roles, restaurantId);

        const restaurant = await this.prismaService.client.restaurant.update({
            where: { id: restaurantId },
            data: { isOpen },
        });

        await this.auditService.log(
            'UPDATE_RESTAURANT_STATUS',
            'Restaurant',
            restaurantId,
            actorId,
            { isOpen },
        );

        return restaurant;
    }

    // async updateRestaurantOperatingHours(
    //     restaurantId: number,
    //     actorId: number,
    //     roles: string[],
    //     operatingHours: any,
    // ) {
    //     await this.assertRestaurantOwner(actorId, roles, restaurantId);

    //     const restaurant = await this.prismaService.client.restaurant.update({
    //         where: { id: restaurantId },
    //         data: { operatingHours },
    //     });

    //     await this.auditService.log(
    //         'UPDATE_RESTAURANT_OPERATING_HOURS',
    //         'Restaurant',
    //         restaurantId,
    //         actorId,
    //         { operatingHours },
    //     );

    //     return restaurant;
    // }

    async replyToRestaurantRating(
        reviewId: number,
        actorId: number,
        roles: string[],
        reply: string,
    ) {
        const rating = await this.prismaService.client.restaurantRating.findFirst({
            where: {
                id: reviewId,
                deleteAt: null,
            },
        });

        if (!rating) {
            throw new NotFoundException('Restaurant review not found');
        }

        await this.assertRestaurantOwner(actorId, roles, rating.restaurantId);

        const updatedRating = await this.prismaService.client.restaurantRating.update({
            where: { id: reviewId },
            data: {
                reply,
                replyCreatedAt: new Date(),
            },
        });

        await this.auditService.log(
            'REPLY_RESTAURANT_REVIEW',
            'RestaurantRating',
            reviewId,
            actorId,
            { reply },
        );

        return updatedRating;
    }

    async updateRestaurantRating(
        reviewId: number,
        userId: number,
        data: UpdateRestaurantRatingDto,
    ) {
        const rating = await this.prismaService.client.restaurantRating.findFirst({
            where: {
                id: reviewId,
                deleteAt: null,
            },
        });

        if (!rating) {
            throw new NotFoundException('Review not found');
        }

        if (rating.userId !== userId) {
            throw new ForbiddenException('You do not have permission to update this review');
        }

        if (data.tags && data.tags.length > 0) {
            const invalidTags = data.tags.filter(t => !ALLOWED_REVIEW_TAGS.includes(t));
            if (invalidTags.length > 0) {
                throw new BadRequestException('Invalid review tags');
            }
        }

        const updatedRating = await this.prismaService.client.restaurantRating.update({
            where: { id: reviewId },
            data: {
                vote: data.vote ?? undefined,
                comment: data.comment ?? undefined,
                tags: data.tags ?? undefined,
            },
        });

        return updatedRating;
    }

    async deleteRestaurantRating(
        reviewId: number,
        userId: number,
        roles: string[],
    ) {
        const rating = await this.prismaService.client.restaurantRating.findFirst({
            where: {
                id: reviewId,
                deleteAt: null,
            },
        });

        if (!rating) {
            throw new NotFoundException('Review not found');
        }

        const isAdmin = roles.includes('ADMIN');
        if (rating.userId !== userId && !isAdmin) {
            throw new ForbiddenException('You do not have permission to delete this review');
        }

        await this.prismaService.client.restaurantRating.delete({
            id: reviewId,
        });

        return {
            success: true,
            message: 'Delete review successfully',
        };
    }

    async getRestaurantRatingsForVendor(
        restaurantId: number,
        actorId: number,
        roles: string[],
    ) {
        await this.assertRestaurantOwner(actorId, roles, restaurantId);

        const ratings = await this.prismaService.client.restaurantRating.findMany({
            where: {
                restaurantId,
                deleteAt: null,
            },
            orderBy: {
                createdAt: 'desc',
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
        });

        return await Promise.all(
            ratings.map(async (r) => {
                let avatarUrl = '';
                if (r.user?.avatar) {
                    if (/^https?:\/\//i.test(r.user.avatar)) {
                        avatarUrl = r.user.avatar;
                    } else {
                        avatarUrl = await this.minioService.getFileUrl(r.user.avatar);
                    }
                }
                return {
                    id: r.id,
                    vote: r.vote,
                    comment: r.comment,
                    tags: r.tags,
                    createdAt: r.createdAt,
                    reply: r.reply,
                    user: {
                        id: r.user.id,
                        name: r.user.name,
                        avatar: avatarUrl,
                    },
                    orderId: r.orderId,
                };
            }),
        );
    }

    async getRestaurantRatingStats(
        restaurantId: number,
        actorId: number,
        roles: string[],
    ) {
        await this.assertRestaurantOwner(actorId, roles, restaurantId);

        const ratings = await this.prismaService.client.restaurantRating.findMany({
            where: {
                restaurantId,
                deleteAt: null,
            },
            select: {
                vote: true,
                tags: true,
            },
        });

        const totalReviews = ratings.length;
        const starCount = {
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
            '5': 0,
        };
        let sumVote = 0;
        const tagMap = new Map<string, number>();

        for (const r of ratings) {
            const star = r.vote.toString() as '1' | '2' | '3' | '4' | '5';
            if (starCount[star] !== undefined) {
                starCount[star]++;
            }
            sumVote += r.vote;

            if (r.tags) {
                const tagsList = Array.isArray(r.tags) ? (r.tags as string[]) : [];
                for (const t of tagsList) {
                    tagMap.set(t, (tagMap.get(t) || 0) + 1);
                }
            }
        }

        const averageRating = totalReviews > 0 ? Number((sumVote / totalReviews).toFixed(1)) : 0;
        const popularTags = Array.from(tagMap.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);

        return {
            averageRating,
            totalReviews,
            starCount,
            popularTags,
        };
    }
}
