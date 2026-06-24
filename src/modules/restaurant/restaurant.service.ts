import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    Prisma,
    Role,
    RestaurantApprovalStatus,
    OrderStatus,
    NotificationType,
    VoucherStatus,
} from '@prisma/client';
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
                status: true,
            },
        });

        if (!restaurant) {
            throw new NotFoundException('Restaurant not found');
        }

        if (this.hasRole(roles, Role.ADMIN)) {
            return restaurant;
        }

        if (restaurant.ownerId !== actorId) {
            throw new ForbiddenException(
                'You are not allowed to manage this restaurant',
            );
        }

        return restaurant;
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
                        status: RestaurantApprovalStatus.APPROVED,
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
                        status: true,
                        deliveryFee: true,
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
                    status: restaurant.status,
                    deliveryFee: Number(restaurant.deliveryFee),
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
                        status: RestaurantApprovalStatus.APPROVED,
                    },
                    select: {
                        id: true,
                        name: true,
                        status: true,
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
                status: restaurant.status,
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
                        status: RestaurantApprovalStatus.APPROVED,
                    },
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        coverImage: true,
                        phone: true,
                        status: true,
                        description: true,
                        deliveryFee: true,
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
                        status: RestaurantApprovalStatus.APPROVED,
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

            if (order.status !== OrderStatus.CONFIRMED) {
                throw new BadRequestException('Only confirmed orders can be rated');
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
                status: RestaurantApprovalStatus.APPROVED,
            },
            select: {
                id: true,
                name: true,
                status: true,
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
            status: restaurant.status,
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

    async registerBusiness(actorId: number) {
        const user = await this.prismaService.client.user.findFirst({
            where: {
                id: actorId,
            },
            select: {
                id: true,
                phone: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (!user.phone) {
            throw new BadRequestException(
                'A phone number is required to register as a business',
            );
        }

        const existingRestaurant =
            await this.prismaService.client.restaurant.findFirst({
                where: {
                    ownerId: actorId,
                },
                select: {
                    id: true,
                },
            });

        if (existingRestaurant) {
            throw new BadRequestException(
                'This user already owns a restaurant',
            );
        }

        const existingBusinessRole =
            await this.prismaService.client.userRole.findFirst({
                where: {
                    userId: actorId,
                    role: Role.BUSINESS,
                },
                select: {
                    id: true,
                },
            });

        if (existingBusinessRole) {
            throw new BadRequestException(
                'This user is already registered as a business',
            );
        }

        await this.prismaService.client.userRole.create({
            data: {
                userId: actorId,
                role: Role.BUSINESS,
            },
        });

        await this.auditService.log(
            'REGISTER_BUSINESS',
            'User',
            actorId,
            actorId,
        );

        return {
            userId: actorId,
            role: Role.BUSINESS,
            requiresTokenRefresh: true,
        };
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

        const existingRestaurant =
            await this.prismaService.client.restaurant.findFirst({
                where: {
                    OR: [
                        {
                            ownerId: actorId,
                        },
                        {
                            phone: data.phone,
                        },
                    ],
                },
                select: {
                    id: true,
                    ownerId: true,
                    phone: true,
                },
            });

        if (existingRestaurant?.ownerId === actorId) {
            throw new BadRequestException(
                'Each user can create only one restaurant',
            );
        }

        if (existingRestaurant?.phone === data.phone) {
            throw new BadRequestException(
                'This restaurant phone number is already registered',
            );
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
            status: RestaurantApprovalStatus.PENDING,
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
        const currentRestaurant = await this.assertRestaurantOwner(
            actorId,
            roles,
            restaurantId,
        );

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
            const restaurantWithPhone =
                await this.prismaService.client.restaurant.findFirst({
                    where: {
                        phone: restaurantPayload.phone,
                        NOT: {
                            id: restaurantId,
                        },
                    },
                    select: {
                        id: true,
                    },
                });

            if (restaurantWithPhone) {
                throw new BadRequestException(
                    'This restaurant phone number is already registered',
                );
            }

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
        if (
            currentRestaurant.status ===
            RestaurantApprovalStatus.REJECTED
        ) {
            updateData.status = RestaurantApprovalStatus.PENDING;
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
            if (order.status === OrderStatus.CONFIRMED) {
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

    async generateRestaurantDashboard(
        restaurantId: number,
        actorId: number,
        roles: string[],
    ) {
        await this.assertRestaurantOwner(actorId, roles, restaurantId);

        const now = new Date();
        const [
            orderStats,
            recentPayments,
            bestSellerStats,
            ratingStats,
            activeVouchers,
        ] = await Promise.all([
            this.prismaService.client.order.groupBy({
                by: ['status'],
                where: {
                    restaurantId,
                    deleteAt: null,
                },
                _count: {
                    id: true,
                },
                _sum: {
                    totalPrice: true,
                },
            }),
            this.prismaService.client.payment.findMany({
                where: {
                    deleteAt: null,
                    order: {
                        restaurantId,
                        deleteAt: null,
                    },
                },
                select: {
                    createdAt: true,
                    order: {
                        select: {
                            id: true,
                            totalPrice: true,
                            status: true,
                            user: {
                                select: {
                                    name: true,
                                },
                            },
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: 5,
            }),
            this.prismaService.client.orderFood.groupBy({
                by: ['foodId'],
                where: {
                    deleteAt: null,
                    order: {
                        restaurantId,
                        status: OrderStatus.CONFIRMED,
                        deleteAt: null,
                    },
                },
                _sum: {
                    quantity: true,
                },
                orderBy: {
                    _sum: {
                        quantity: 'desc',
                    },
                },
                take: 5,
            }),
            this.prismaService.client.restaurantRating.aggregate({
                where: {
                    restaurantId,
                    deleteAt: null,
                },
                _avg: {
                    vote: true,
                },
                _count: {
                    id: true,
                },
            }),
            this.prismaService.client.voucher.count({
                where: {
                    restaurantId,
                    status: VoucherStatus.APPLYING,
                    deleteAt: null,
                    AND: [
                        {
                            OR: [{ startAt: null }, { startAt: { lte: now } }],
                        },
                        {
                            OR: [{ endAt: null }, { endAt: { gte: now } }],
                        },
                    ],
                },
            }),
        ]);

        const foodIds = bestSellerStats.map((item) => item.foodId);
        const foods = foodIds.length
            ? await this.prismaService.client.food.findMany({
                  where: {
                      id: {
                          in: foodIds,
                      },
                      deleteAt: null,
                  },
                  select: {
                      id: true,
                      name: true,
                      price: true,
                      image: true,
                      rating: true,
                      ratings: {
                          where: {
                              deleteAt: null,
                          },
                          select: {
                              vote: true,
                          },
                      },
                  },
              })
            : [];
        const foodsById = new Map(foods.map((food) => [food.id, food]));
        const getOrderCount = (statuses: OrderStatus[]) =>
            orderStats
                .filter((item) => statuses.includes(item.status))
                .reduce((total, item) => total + item._count.id, 0);
        const deliveredStats = orderStats.find(
            (item) => item.status === OrderStatus.CONFIRMED,
        );

        return {
            runningOrders: getOrderCount([
                OrderStatus.PREPARING,
                OrderStatus.DELIVERING,
                OrderStatus.DELIVERED,
            ]),
            orderRequest: getOrderCount([OrderStatus.PENDING]),
            revenue: Number(deliveredStats?._sum.totalPrice ?? 0),
            rating: Number((ratingStats._avg.vote ?? 0).toFixed(1)),
            totalReviews: ratingStats._count.id,
            totalOrders: orderStats.reduce(
                (total, item) => total + item._count.id,
                0,
            ),
            activeVouchers,
            recentOrders: recentPayments.map(({ order, createdAt }) => ({
                id: String(order.id),
                orderNumber: String(order.id).padStart(4, '0'),
                customerName: order.user.name,
                totalPrice: Number(order.totalPrice),
                status: order.status
                    .toLowerCase()
                    .split('_')
                    .map(
                        (word) =>
                            word.charAt(0).toUpperCase() + word.slice(1),
                    )
                    .join(' '),
                time: createdAt.toLocaleTimeString('en-US', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                }),
            })),
            bestSellers: bestSellerStats.flatMap((item) => {
                const food = foodsById.get(item.foodId);
                if (!food) {
                    return [];
                }

                const rating = food.ratings.length
                    ? food.ratings.reduce(
                          (total, review) => total + review.vote,
                          0,
                      ) / food.ratings.length
                    : food.rating;

                return [
                    {
                        id: food.id,
                        name: food.name,
                        price: Number(food.price),
                        rating: Number(rating.toFixed(1)),
                        soldCount: item._sum.quantity ?? 0,
                        imageUrl: food.image,
                    },
                ];
            }),
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
                status: OrderStatus.CONFIRMED,
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
