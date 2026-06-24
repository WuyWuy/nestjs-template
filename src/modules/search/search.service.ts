import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RestaurantApprovalStatus } from '@prisma/client';
import {
    SearchQueryDto,
    SearchSuggestionsQueryDto,
    SaveSearchHistoryDto,
    TrendingQueryDto,
} from './dto/search.dto';

@Injectable()
export class SearchService {
    constructor(private readonly prismaService: PrismaService) {}

    async search(query: SearchQueryDto) {
        const { q, lat, lng, limit = 20, offset = 0, sort, categoryId } = query;
        const now = new Date();

        // 1. Vouchers đang hoạt động
        const activeVouchers = await this.prismaService.client.voucher.findMany({
            where: {
                status: 'APPLYING',
                AND: [
                    {
                        OR: [
                            { startAt: null },
                            { startAt: { lte: now } },
                        ],
                    },
                    {
                        OR: [
                            { endAt: null },
                            { endAt: { gte: now } },
                        ],
                    },
                ],
            },
        });

        // Map restaurantId -> max percent discount tag
        const restaurantPromoMap = new Map<number, string>();
        for (const voucher of activeVouchers) {
            if (voucher.restaurantId && voucher.type === 'PERCENT') {
                const currentMax = restaurantPromoMap.get(voucher.restaurantId);
                const currentSaleValue = currentMax ? parseInt(currentMax.replace('Giảm ', '').replace('%', '')) : 0;
                if (voucher.sale > currentSaleValue) {
                    restaurantPromoMap.set(voucher.restaurantId, `Giảm ${voucher.sale}%`);
                }
            }
        }

        // 2. soldCount của món ăn từ DELIVERED orders
        const soldCounts = await this.prismaService.client.orderFood.groupBy({
            by: ['foodId'],
            _sum: {
                quantity: true,
            },
            where: {
                order: {
                    status: 'DELIVERED',
                },
            },
        });
        const soldCountMap = new Map<number, number>();
        for (const item of soldCounts) {
            soldCountMap.set(item.foodId, item._sum.quantity || 0);
        }

        // 3. averageRating của nhà hàng
        const avgRatings = await this.prismaService.client.restaurantRating.groupBy({
            by: ['restaurantId'],
            _avg: {
                vote: true,
            },
        });
        const avgRatingMap = new Map<number, number>();
        for (const item of avgRatings) {
            avgRatingMap.set(item.restaurantId, parseFloat((item._avg.vote || 0).toFixed(1)));
        }

        // --- TRUY VẤN MÓN ĂN (FOODS) ---
        const foodsDb = await this.prismaService.client.food.findMany({
            where: {
                deleteAt: null,
                isAvailable: true,
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    { label: { contains: q, mode: 'insensitive' } },
                ],
                categoryId: categoryId ? categoryId : undefined,
            },
            include: {
                restaurant: {
                    include: {
                        address: true,
                    },
                },
                ratings: {
                    select: {
                        vote: true,
                    },
                },
            },
        });

        const mappedFoods = foodsDb.map((food) => {
            const avgFoodRating = food.ratings.length > 0
                ? parseFloat((food.ratings.reduce((sum, r) => sum + r.vote, 0) / food.ratings.length).toFixed(1))
                : food.rating;

            let distance = 0;
            if (lat !== undefined && lng !== undefined && food.restaurant.address.latitude && food.restaurant.address.longitude) {
                distance = calculateDistance(lat, lng, food.restaurant.address.latitude, food.restaurant.address.longitude);
            }

            return {
                id: food.id,
                name: food.name,
                price: Number(food.price),
                imageUrl: food.image,
                restaurantId: food.restaurantId,
                restaurantName: food.restaurant.name,
                rating: avgFoodRating,
                soldCount: soldCountMap.get(food.id) || 0,
                promoTag: restaurantPromoMap.get(food.restaurantId) || null,
                distance,
                updatedAt: food.updatedAt,
            };
        });

        // Sắp xếp Foods
        if (sort === 'distance' && lat !== undefined && lng !== undefined) {
            mappedFoods.sort((a, b) => a.distance - b.distance);
        } else if (sort === 'rating') {
            mappedFoods.sort((a, b) => b.rating - a.rating);
        } else if (sort === 'price_low_to_high') {
            mappedFoods.sort((a, b) => a.price - b.price);
        } else {
            mappedFoods.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        }

        // Phân trang Foods
        const slicedFoods = mappedFoods.slice(offset, offset + limit).map(({ distance, updatedAt, ...rest }) => rest);


        // --- TRUY VẤN NHÀ HÀNG (RESTAURANTS) ---
        const restaurantsDb = await this.prismaService.client.restaurant.findMany({
            where: {
                deleteAt: null,
                status: RestaurantApprovalStatus.APPROVED,
                OR: [
                    { name: { contains: q, mode: 'insensitive' } },
                    {
                        foods: {
                            some: {
                                deleteAt: null,
                                isAvailable: true,
                                OR: [
                                    { name: { contains: q, mode: 'insensitive' } },
                                    { label: { contains: q, mode: 'insensitive' } },
                                ],
                            },
                        },
                    },
                ],
                foods: categoryId ? {
                    some: {
                        categoryId,
                        deleteAt: null,
                        isAvailable: true,
                    }
                } : undefined,
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

        const mappedRestaurants = restaurantsDb.map((restaurant) => {
            let distance = 0;
            if (lat !== undefined && lng !== undefined && restaurant.address.latitude && restaurant.address.longitude) {
                distance = calculateDistance(lat, lng, restaurant.address.latitude, restaurant.address.longitude);
            }

            const tags = Array.from(
                new Set(
                    restaurant.foods
                        .map((f) => f.category?.name)
                        .filter(Boolean)
                )
            );

            const hasVoucher = activeVouchers.some(v => v.restaurantId === restaurant.id);
            const averageRating = avgRatingMap.get(restaurant.id) || 0;

            return {
                id: restaurant.id,
                name: restaurant.name,
                imageUrl: restaurant.image,
                averageRating,
                deliveryFee: Number(restaurant.deliveryFee),
                distance,
                tags,
                hasVoucher,
                createdAt: restaurant.createdAt,
            };
        });

        // Sắp xếp Restaurants
        if (sort === 'distance' && lat !== undefined && lng !== undefined) {
            mappedRestaurants.sort((a, b) => a.distance - b.distance);
        } else if (sort === 'rating') {
            mappedRestaurants.sort((a, b) => b.averageRating - a.averageRating);
        } else {
            mappedRestaurants.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        // Phân trang Restaurants
        const slicedRestaurants = mappedRestaurants.slice(offset, offset + limit).map(({ createdAt, ...rest }) => {
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
        const now = new Date();

        // 1. Lọc vouchers đang hoạt động
        const activeVouchers = await this.prismaService.client.voucher.findMany({
            where: {
                status: 'APPLYING',
                AND: [
                    { OR: [{ startAt: null }, { startAt: { lte: now } }] },
                    { OR: [{ endAt: null }, { endAt: { gte: now } }] },
                ],
            },
        });
        const hasVoucherSet = new Set(activeVouchers.map(v => v.restaurantId).filter(Boolean));

        // Map restaurantId -> max percent discount tag
        const restaurantPromoMap = new Map<number, string>();
        for (const voucher of activeVouchers) {
            if (voucher.restaurantId && voucher.type === 'PERCENT') {
                const currentMax = restaurantPromoMap.get(voucher.restaurantId);
                const currentSaleValue = currentMax ? parseInt(currentMax.replace('Giảm ', '').replace('%', '')) : 0;
                if (voucher.sale > currentSaleValue) {
                    restaurantPromoMap.set(voucher.restaurantId, `Giảm ${voucher.sale}%`);
                }
            }
        }

        // 2. averageRating của nhà hàng
        const avgRatings = await this.prismaService.client.restaurantRating.groupBy({
            by: ['restaurantId'],
            _avg: {
                vote: true,
            },
        });
        const avgRatingMap = new Map<number, number>();
        for (const item of avgRatings) {
            avgRatingMap.set(item.restaurantId, parseFloat((item._avg.vote || 0).toFixed(1)));
        }

        // --- SUGGESTED FOODS (TOP SELLER) ---
        const topFoods = await this.prismaService.client.orderFood.groupBy({
            by: ['foodId'],
            _sum: {
                quantity: true,
            },
            where: {
                order: {
                    status: 'DELIVERED',
                },
                food: {
                    deleteAt: null,
                    isAvailable: true,
                },
            },
            orderBy: {
                _sum: {
                    quantity: 'desc',
                },
            },
            take: limit,
        });

        const topFoodIds = topFoods.map(f => f.foodId);
        
        let foodsDb = await this.prismaService.client.food.findMany({
            where: {
                id: { in: topFoodIds },
                deleteAt: null,
                isAvailable: true,
            },
            include: {
                restaurant: {
                    include: {
                        address: true,
                    },
                },
                ratings: {
                    select: {
                        vote: true,
                    },
                },
            },
        });

        // Nếu thiếu thì lấy thêm món mặc định xếp theo rating
        if (foodsDb.length < limit) {
            const extraFoods = await this.prismaService.client.food.findMany({
                where: {
                    id: { notIn: topFoodIds },
                    deleteAt: null,
                    isAvailable: true,
                },
                include: {
                    restaurant: {
                        include: {
                            address: true,
                        },
                    },
                    ratings: {
                        select: {
                            vote: true,
                        },
                    },
                },
                take: limit - foodsDb.length,
                orderBy: {
                    rating: 'desc',
                },
            });
            foodsDb = [...foodsDb, ...extraFoods];
        }

        // Map soldCount cho Foods
        const soldCounts = await this.prismaService.client.orderFood.groupBy({
            by: ['foodId'],
            _sum: {
                quantity: true,
            },
            where: {
                foodId: { in: foodsDb.map(f => f.id) },
                order: {
                    status: 'DELIVERED',
                },
            },
        });
        const soldCountMap = new Map<number, number>();
        for (const item of soldCounts) {
            soldCountMap.set(item.foodId, item._sum.quantity || 0);
        }

        const mappedFoods = foodsDb.map((food) => {
            const avgFoodRating = food.ratings.length > 0
                ? parseFloat((food.ratings.reduce((sum, r) => sum + r.vote, 0) / food.ratings.length).toFixed(1))
                : food.rating;

            return {
                id: food.id,
                name: food.name,
                price: Number(food.price),
                imageUrl: food.image,
                restaurantId: food.restaurantId,
                restaurantName: food.restaurant.name,
                rating: avgFoodRating,
                soldCount: soldCountMap.get(food.id) || 0,
                promoTag: restaurantPromoMap.get(food.restaurantId) || null,
            };
        });


        // --- SUGGESTED RESTAURANTS ---
        const allRestaurants = await this.prismaService.client.restaurant.findMany({
            where: {
                deleteAt: null,
                status: RestaurantApprovalStatus.APPROVED,
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

        const filteredRestaurants = allRestaurants.filter((restaurant) => {
            const hasVoucher = hasVoucherSet.has(restaurant.id);
            const averageRating = avgRatingMap.get(restaurant.id) || 0;
            return hasVoucher || averageRating >= 4.5;
        });

        let suggestedRestaurants = filteredRestaurants.map((restaurant) => {
            let distance = 0;
            if (lat !== undefined && lng !== undefined && restaurant.address.latitude && restaurant.address.longitude) {
                distance = calculateDistance(lat, lng, restaurant.address.latitude, restaurant.address.longitude);
            }

            const tags = Array.from(
                new Set(
                    restaurant.foods
                        .map((f) => f.category?.name)
                        .filter(Boolean)
                )
            );

            const hasVoucher = hasVoucherSet.has(restaurant.id);
            const averageRating = avgRatingMap.get(restaurant.id) || 0;

            return {
                id: restaurant.id,
                name: restaurant.name,
                imageUrl: restaurant.image,
                averageRating,
                deliveryFee: Number(restaurant.deliveryFee),
                distance,
                tags,
                hasVoucher,
                createdAt: restaurant.createdAt,
            };
        });

        let useFallback = false;
        if (lat !== undefined && lng !== undefined) {
            const within10km = suggestedRestaurants.filter(r => r.distance <= 10.0);
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

        const finalRestaurants = suggestedRestaurants.slice(0, limit).map(({ createdAt, ...rest }) => {
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
        return await this.prismaService.client.searchHistory.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async saveHistory(userId: number, data: SaveSearchHistoryDto) {
        const { keyword } = data;
        return await this.prismaService.client.searchHistory.upsert({
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
        await this.prismaService.client.searchHistory.deleteMany({
            userId,
        });
        return {
            success: true,
            message: 'Clear search history successfully',
        };
    }

    async deleteHistoryItem(userId: number, id: number) {
        const historyItem = await this.prismaService.client.searchHistory.findFirst({
            where: {
                id,
            },
        });

        if (!historyItem) {
            throw new NotFoundException('History item not found');
        }

        if (historyItem.userId !== userId) {
            throw new ForbiddenException('You do not have permission to delete this history item');
        }

        await this.prismaService.client.searchHistory.delete({
            id,
        });

        return {
            success: true,
            message: 'Delete history item successfully',
        };
    }

    async getTrending(query: TrendingQueryDto) {
        const { limit = 10 } = query;
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const trends = await this.prismaService.client.searchHistory.groupBy({
            by: ['keyword'],
            _count: {
                keyword: true,
            },
            where: {
                createdAt: {
                    gte: sevenDaysAgo,
                },
            },
            orderBy: {
                _count: {
                    keyword: 'desc',
                },
            },
            take: limit,
        });

        return trends.map((t) => ({
            keyword: t.keyword,
            searchCount: t._count.keyword,
        }));
    }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Bán kính Trái Đất tính bằng km
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
