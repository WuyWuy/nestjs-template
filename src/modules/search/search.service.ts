import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { OrderStatus, RestaurantApprovalStatus } from '@prisma/client';
import { VoucherService } from '../voucher/voucher.service';
import {
    SearchQueryDto,
    SearchSuggestionsQueryDto,
    SaveSearchHistoryDto,
    TrendingQueryDto,
} from './dto/search.dto';

const SOLD_ORDER_STATUSES: OrderStatus[] = [OrderStatus.CONFIRMED];

type CustomerVoucher = Awaited<
    ReturnType<VoucherService['getCustomerActiveVouchers']>
>[number];

@Injectable()
export class SearchService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly voucherService: VoucherService,
    ) {}

    async search(query: SearchQueryDto) {
        const { q, lat, lng, limit = 20, offset = 0, sort, categoryId } = query;
        const keyword = q.trim();

        const foodKeywordFilter = buildFoodKeywordFilter(keyword);

        const foodsDb = await this.prismaService.client.food.findMany({
            where: {
                deleteAt: null,
                isAvailable: true,
                category: {
                    isActive: true,
                    deleteAt: null,
                },
                restaurant: {
                    isActive: true,
                    deleteAt: null,
                    status: RestaurantApprovalStatus.APPROVED,
                },
                OR: foodKeywordFilter,
                categoryId: categoryId ? categoryId : undefined,
            },
            include: {
                restaurant: {
                    include: {
                        address: true,
                    },
                },
                ratings: {
                    where: { deleteAt: null },
                    select: {
                        vote: true,
                    },
                },
            },
        });

        const restaurantsDb = await this.prismaService.client.restaurant.findMany({
            where: {
                deleteAt: null,
                status: RestaurantApprovalStatus.APPROVED,
                isActive: true,
                OR: [
                    { name: { contains: keyword, mode: 'insensitive' } },
                    {
                        foods: {
                            some: {
                                deleteAt: null,
                                isAvailable: true,
                                OR: foodKeywordFilter,
                            },
                        },
                    },
                ],
                foods: categoryId
                    ? {
                          some: {
                              categoryId,
                              deleteAt: null,
                              isAvailable: true,
                          },
                      }
                    : undefined,
            },
            include: {
                address: true,
                foods: {
                    where: {
                        deleteAt: null,
                    },
                    include: {
                        category: true,
                    },
                },
            },
        });

        const foodIds = foodsDb.map((food) => food.id);
        const restaurantIds = [
            ...new Set([
                ...restaurantsDb.map((restaurant) => restaurant.id),
                ...foodsDb.map((food) => food.restaurantId),
            ]),
        ];

        const [activeVouchers, soldCounts, avgRatings] = await Promise.all([
            restaurantIds.length > 0
                ? this.voucherService.getCustomerActiveVouchers(restaurantIds)
                : Promise.resolve([]),
            foodIds.length > 0
                ? this.prismaService.client.orderFood.groupBy({
                      by: ['foodId'],
                      _sum: { quantity: true },
                      where: {
                          foodId: { in: foodIds },
                          order: { status: { in: SOLD_ORDER_STATUSES } },
                      },
                  })
                : Promise.resolve([]),
            restaurantIds.length > 0
                ? this.prismaService.client.restaurantRating.groupBy({
                      by: ['restaurantId'],
                      _avg: { vote: true },
                      where: {
                          restaurantId: { in: restaurantIds },
                          deleteAt: null,
                      },
                  })
                : Promise.resolve([]),
        ]);

        const voucherMap = groupVouchersByRestaurantId(activeVouchers);
        const soldCountMap = new Map<number, number>();
        for (const item of soldCounts) {
            soldCountMap.set(item.foodId, item._sum.quantity || 0);
        }
        const avgRatingMap = new Map<number, number>();
        for (const item of avgRatings) {
            avgRatingMap.set(
                item.restaurantId,
                parseFloat((item._avg.vote || 0).toFixed(1)),
            );
        }

        const mappedFoods = foodsDb.map((food) => {
            let distance = 0;
            if (
                lat !== undefined &&
                lng !== undefined &&
                isValidCoordinate(food.restaurant.address.latitude) &&
                isValidCoordinate(food.restaurant.address.longitude)
            ) {
                distance = calculateDistance(
                    lat,
                    lng,
                    food.restaurant.address.latitude,
                    food.restaurant.address.longitude,
                );
            }

            return {
                id: food.id,
                name: food.name,
                price: Number(food.price),
                imageUrl: food.image,
                restaurantId: food.restaurantId,
                restaurantName: food.restaurant.name,
                rating: computeFoodRating(food),
                soldCount: soldCountMap.get(food.id) || 0,
                distance,
                updatedAt: food.updatedAt,
            };
        });

        if (sort === 'distance' && lat !== undefined && lng !== undefined) {
            mappedFoods.sort((a, b) => a.distance - b.distance);
        } else if (sort === 'rating') {
            mappedFoods.sort((a, b) => b.rating - a.rating);
        } else if (sort === 'price_low_to_high') {
            mappedFoods.sort((a, b) => a.price - b.price);
        } else {
            mappedFoods.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }

        const slicedFoods = mappedFoods
            .slice(offset, offset + limit)
            .map(({ distance, updatedAt, ...rest }) => rest);

        const mappedRestaurants = restaurantsDb.map((restaurant) => {
            let distance = 0;
            if (
                lat !== undefined &&
                lng !== undefined &&
                isValidCoordinate(restaurant.address.latitude) &&
                isValidCoordinate(restaurant.address.longitude)
            ) {
                distance = calculateDistance(
                    lat,
                    lng,
                    restaurant.address.latitude,
                    restaurant.address.longitude,
                );
            }

            const tags = Array.from(
                new Set(
                    restaurant.foods
                        .map((f) => f.category?.name)
                        .filter(Boolean),
                ),
            );

            const restaurantVouchers = voucherMap.get(restaurant.id) ?? [];
            const averageRating = avgRatingMap.get(restaurant.id) || 0;

            return {
                id: restaurant.id,
                name: restaurant.name,
                imageUrl: restaurant.image,
                averageRating,
                deliveryFee: Number(restaurant.deliveryFee),
                distance,
                tags,
                hasVoucher: restaurantVouchers.length > 0,
                vouchers: restaurantVouchers,
                createdAt: restaurant.createdAt,
            };
        });

        if (sort === 'distance' && lat !== undefined && lng !== undefined) {
            mappedRestaurants.sort((a, b) => a.distance - b.distance);
        } else if (sort === 'rating') {
            mappedRestaurants.sort((a, b) => b.averageRating - a.averageRating);
        } else {
            mappedRestaurants.sort(
                (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
            );
        }

        const slicedRestaurants = mappedRestaurants
            .slice(offset, offset + limit)
            .map(({ createdAt, ...rest }) => {
                if (lat === undefined || lng === undefined) {
                    return { ...rest, distance: 0 };
                }
                return rest;
            });

        return {
            foods: slicedFoods,
            restaurants: slicedRestaurants,
        };
    }

    async getSuggestions(query: SearchSuggestionsQueryDto) {
        const { lat, lng, limit = 10 } = query;

        const activeVouchers =
            await this.voucherService.getCustomerActiveVouchers();
        const voucherMap = groupVouchersByRestaurantId(activeVouchers);
        const hasVoucherSet = new Set(voucherMap.keys());

        const avgRatings = await this.prismaService.client.restaurantRating.groupBy({
            by: ['restaurantId'],
            _avg: { vote: true },
            where: {
                deleteAt: null,
            },
        });
        const avgRatingMap = new Map<number, number>();
        for (const item of avgRatings) {
            avgRatingMap.set(
                item.restaurantId,
                parseFloat((item._avg.vote || 0).toFixed(1)),
            );
        }

        const topFoods = await this.prismaService.client.orderFood.groupBy({
            by: ['foodId'],
            _sum: { quantity: true },
            where: {
                order: { status: { in: SOLD_ORDER_STATUSES } },
                food: {
                    deleteAt: null,
                    isAvailable: true,
                },
            },
            orderBy: {
                _sum: { quantity: 'desc' },
            },
            take: limit,
        });

        const topFoodIds = topFoods.map((f) => f.foodId);

        let foodsDb = await this.prismaService.client.food.findMany({
            where: {
                id: { in: topFoodIds },
                deleteAt: null,
                isAvailable: true,
                category: {
                    isActive: true,
                    deleteAt: null,
                },
                restaurant: {
                    isActive: true,
                    deleteAt: null,
                    status: RestaurantApprovalStatus.APPROVED,
                },
            },
            include: {
                restaurant: {
                    include: {
                        address: true,
                    },
                },
                ratings: {
                    where: { deleteAt: null },
                    select: { vote: true },
                },
            },
        });

        const foodsById = new Map(foodsDb.map((food) => [food.id, food]));
        foodsDb = topFoodIds
            .map((id) => foodsById.get(id))
            .filter((food): food is NonNullable<typeof food> => food !== undefined);

        if (foodsDb.length < limit) {
            const extraFoods = await this.prismaService.client.food.findMany({
                where: {
                    id: { notIn: topFoodIds },
                    deleteAt: null,
                    isAvailable: true,
                    category: {
                        isActive: true,
                        deleteAt: null,
                    },
                    restaurant: {
                        isActive: true,
                        deleteAt: null,
                        status: RestaurantApprovalStatus.APPROVED,
                    },
                },
                include: {
                    restaurant: {
                        include: {
                            address: true,
                        },
                    },
                    ratings: {
                        where: { deleteAt: null },
                        select: { vote: true },
                    },
                },
                take: limit - foodsDb.length,
                orderBy: { rating: 'desc' },
            });
            foodsDb = [...foodsDb, ...extraFoods];
        }

        const soldCounts =
            foodsDb.length > 0
                ? await this.prismaService.client.orderFood.groupBy({
                      by: ['foodId'],
                      _sum: { quantity: true },
                      where: {
                          foodId: { in: foodsDb.map((f) => f.id) },
                          order: { status: { in: SOLD_ORDER_STATUSES } },
                      },
                  })
                : [];
        const soldCountMap = new Map<number, number>();
        for (const item of soldCounts) {
            soldCountMap.set(item.foodId, item._sum.quantity || 0);
        }

        const mappedFoods = foodsDb.slice(0, limit).map((food) => ({
            id: food.id,
            name: food.name,
            price: Number(food.price),
            imageUrl: food.image,
            restaurantId: food.restaurantId,
            restaurantName: food.restaurant.name,
            rating: computeFoodRating(food),
            soldCount: soldCountMap.get(food.id) || 0,
        }));

        const qualifyingRestaurantIds = new Set<number>(hasVoucherSet);
        for (const item of avgRatings) {
            if ((item._avg.vote || 0) >= 4.5) {
                qualifyingRestaurantIds.add(item.restaurantId);
            }
        }

        const candidateRestaurants =
            qualifyingRestaurantIds.size > 0
                ? await this.prismaService.client.restaurant.findMany({
                      where: {
                          id: { in: Array.from(qualifyingRestaurantIds) },
                          deleteAt: null,
                          status: RestaurantApprovalStatus.APPROVED,
                          isActive: true,
                      },
                      include: {
                          address: true,
                          foods: {
                              where: { deleteAt: null },
                              include: { category: true },
                          },
                      },
                  })
                : [];

        let suggestedRestaurants = candidateRestaurants.map((restaurant) => {
            let distance = 0;
            if (
                lat !== undefined &&
                lng !== undefined &&
                isValidCoordinate(restaurant.address.latitude) &&
                isValidCoordinate(restaurant.address.longitude)
            ) {
                distance = calculateDistance(
                    lat,
                    lng,
                    restaurant.address.latitude,
                    restaurant.address.longitude,
                );
            }

            const tags = Array.from(
                new Set(
                    restaurant.foods
                        .map((f) => f.category?.name)
                        .filter(Boolean),
                ),
            );

            return {
                id: restaurant.id,
                name: restaurant.name,
                imageUrl: restaurant.image,
                averageRating: avgRatingMap.get(restaurant.id) || 0,
                deliveryFee: Number(restaurant.deliveryFee),
                distance,
                tags,
                hasVoucher: (voucherMap.get(restaurant.id) ?? []).length > 0,
                vouchers: voucherMap.get(restaurant.id) ?? [],
                createdAt: restaurant.createdAt,
            };
        });

        let useFallback = false;
        if (lat !== undefined && lng !== undefined) {
            const within10km = suggestedRestaurants.filter((r) => r.distance <= 10.0);
            if (within10km.length > 0) {
                suggestedRestaurants = within10km;
                suggestedRestaurants.sort((a, b) => a.distance - b.distance);
            } else {
                useFallback = true;
            }
        } else {
            useFallback = true;
        }

        if (useFallback) {
            suggestedRestaurants.sort((a, b) => {
                if (b.averageRating !== a.averageRating) {
                    return b.averageRating - a.averageRating;
                }
                return b.createdAt.getTime() - a.createdAt.getTime();
            });
        }

        const finalRestaurants = suggestedRestaurants
            .slice(0, limit)
            .map(({ createdAt, ...rest }) => {
                if (lat === undefined || lng === undefined) {
                    return { ...rest, distance: 0 };
                }
                return rest;
            });

        return {
            foods: mappedFoods,
            restaurants: finalRestaurants,
        };
    }

    async getHistory(userId: number) {
        return await this.prismaService.searchHistory.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async saveHistory(userId: number, data: SaveSearchHistoryDto) {
        const keyword = data.keyword.trim();
        return await this.prismaService.searchHistory.upsert({
            where: {
                userId_keyword: {
                    userId,
                    keyword,
                },
            },
            update: {
                createdAt: new Date(),
            },
            create: {
                userId,
                keyword,
            },
        });
    }

    async clearHistory(userId: number) {
        await this.prismaService.searchHistory.deleteMany({
            where: { userId },
        });
        return {
            message: 'Clear search history successfully',
        };
    }

    async deleteHistoryItem(userId: number, id: number) {
        const historyItem = await this.prismaService.searchHistory.findFirst({
            where: { id },
        });

        if (!historyItem) {
            throw new NotFoundException('History item not found');
        }

        if (historyItem.userId !== userId) {
            throw new ForbiddenException(
                'You do not have permission to delete this history item',
            );
        }

        await this.prismaService.searchHistory.delete({
            where: { id },
        });

        return {
            message: 'Delete history item successfully',
        };
    }

    async getTrending(query: TrendingQueryDto) {
        const { limit = 10 } = query;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const trends = await this.prismaService.searchHistory.groupBy({
            by: ['keyword'],
            _count: { keyword: true },
            where: {
                createdAt: { gte: sevenDaysAgo },
            },
            orderBy: {
                _count: { keyword: 'desc' },
            },
            take: limit,
        });

        return trends.map((t) => ({
            keyword: t.keyword,
            searchCount: t._count.keyword,
        }));
    }
}

function groupVouchersByRestaurantId(vouchers: CustomerVoucher[]) {
    const map = new Map<number, CustomerVoucher[]>();
    for (const voucher of vouchers) {
        if (voucher.restaurantId == null) {
            continue;
        }
        const existing = map.get(voucher.restaurantId) ?? [];
        existing.push(voucher);
        map.set(voucher.restaurantId, existing);
    }
    return map;
}

function buildFoodKeywordFilter(keyword: string) {
    return [
        { name: { contains: keyword, mode: 'insensitive' as const } },
        { label: { contains: keyword, mode: 'insensitive' as const } },
        {
            category: {
                name: { contains: keyword, mode: 'insensitive' as const },
                isActive: true,
                deleteAt: null,
            },
        },
    ];
}

function computeFoodRating(food: {
    ratings: { vote: number }[];
    rating: number;
}) {
    if (food.ratings.length > 0) {
        return parseFloat(
            (
                food.ratings.reduce((sum, r) => sum + r.vote, 0) /
                food.ratings.length
            ).toFixed(1),
        );
    }
    return Number(food.rating);
}

function isValidCoordinate(value: number | null | undefined): value is number {
    return value != null;
}

function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
}
