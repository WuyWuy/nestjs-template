import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class FavoriteService {
    constructor(private readonly prismaService: PrismaService) {}

    async toggleFavorite(userId: number, restaurantId: number) {
        const restaurant = await this.prismaService.client.restaurant.findUnique({
            where: { id: restaurantId },
        });

        if (!restaurant) {
            throw new NotFoundException('Restaurant not found');
        }

        const favorite = await this.prismaService.client.userFavoriteRestaurant.findUnique({
            where: {
                userId_restaurantId: {
                    userId,
                    restaurantId,
                },
            },
        });

        let isLiked = false;

        if (favorite) {
            await this.prismaService.client.userFavoriteRestaurant.delete({
                userId_restaurantId: {
                    userId,
                    restaurantId,
                },
            });
            isLiked = false;
        } else {
            await this.prismaService.client.userFavoriteRestaurant.create({
                data: {
                    userId,
                    restaurantId,
                },
            });
            isLiked = true;
        }

        const totalLikes = await this.prismaService.client.userFavoriteRestaurant.count({
            where: { restaurantId },
        });

        return {
            restaurantId,
            isLiked,
            totalLikes,
        };
    }

    async getFavorites(userId: number, limit: number, offset: number) {
        const total = await this.prismaService.client.userFavoriteRestaurant.count({
            where: { userId },
        });

        const favorites = await this.prismaService.client.userFavoriteRestaurant.findMany({
            where: { userId },
            skip: offset,
            take: limit,
            select: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        deliveryFee: true,
                        ratings: {
                            select: {
                                vote: true,
                            },
                        },
                        foods: {
                            select: {
                                category: {
                                    select: {
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        const data = favorites.map((f) => {
            const r = f.restaurant;
            const ratings = r.ratings || [];
            const voteCount = ratings.length;
            const averageRating =
                voteCount > 0
                    ? Math.round((ratings.reduce((sum, item) => sum + item.vote, 0) / voteCount) * 10) / 10
                    : 0;

            const tags = Array.from(new Set(r.foods.map((food) => food.category.name)));

            return {
                id: r.id,
                name: r.name,
                image: r.image,
                rating: averageRating,
                deliveryFee: Number(r.deliveryFee),
                tags,
                isLiked: true,
            };
        });

        return {
            data,
            pagination: {
                total,
                limit,
                offset,
            },
        };
    }

    async getLikeStatus(userId: number, restaurantId: number) {
        const favorite = await this.prismaService.client.userFavoriteRestaurant.findUnique({
            where: {
                userId_restaurantId: {
                    userId,
                    restaurantId,
                },
            },
        });

        return {
            isLiked: !!favorite,
        };
    }
}
