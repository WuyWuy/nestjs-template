import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CategoryService } from '../category/category.service';
import { RestaurantService } from '../restaurant/restaurant.service';
import { MinioService } from '../minio/minio.service';

@Injectable()
export class HomeService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly categoryService: CategoryService,
        private readonly restaurantService: RestaurantService,
        private readonly minioService: MinioService,
    ) {}

    private async resolveFileUrl(fileName: string | null) {
        if (!fileName) return '';
        if (/^https?:\/\//i.test(fileName)) return fileName;
        try {
            return await this.minioService.getFileUrl(fileName);
        } catch {
            return '';
        }
    }

    async getCounters(userId: number) {
        const cart = await this.prismaService.client.cart.findFirst({
            where: { userId },
            select: { id: true },
        });

        let cartItemCount = 0;
        if (cart) {
            const sumResult = await this.prismaService.client.cartItem.aggregate({
                where: { cartId: cart.id , deleteAt: null },
                _sum: { quantity: true },
            });
            cartItemCount = sumResult._sum.quantity || 0;
        }

        const unreadMessageCount = await this.prismaService.client.message.count({
            where: {
                isRead: false,
                senderId: { not: userId },
                conversation: {
                    OR: [
                        { customerId: userId },
                        { sellerId: userId },
                    ],
                },
            },
        });

        return {
            cartItemCount,
            unreadMessageCount,
        };
    }

    async getDashboard(lat?: number, lng?: number, userId?: number) {
        let user = null;
        let counters = {
            cartItemCount: 0,
            unreadMessageCount: 0,
        };
        let addresses: { id: number; title: string; fullText: string }[] = [];

        if (userId) {
            const userDb = await this.prismaService.client.user.findFirst({
                where: { id: userId },
                select: {
                    id: true,
                    name: true,
                    avatar: true,
                    phone: true,
                },
            });

            if (userDb) {
                user = {
                    id: userDb.id,
                    fullName: userDb.name,
                    avatarUrl: await this.resolveFileUrl(userDb.avatar),
                    phone: userDb.phone ?? '',
                };
            }

            const userAddresses = await this.prismaService.client.userAddress.findMany({
                where: { userId, deleteAt: null },
                select: {
                    id: true,
                    title: true,
                    address: {
                        select: {
                            fullText: true,
                        },
                    },
                },
                orderBy: {
                    id: 'asc',
                },
            });

            addresses = userAddresses.map((item) => ({
                id: item.id,
                title: item.title,
                fullText: item.address?.fullText ?? '',
            }));

            counters = await this.getCounters(userId);
        }

        // Lấy top 10 categories
        const categoriesResult = await this.categoryService.getCategories({ limit: 10 });
        const categoryItems = Array.isArray(categoriesResult)
            ? categoriesResult
            : categoriesResult.data;
        const categories = categoryItems.map((cat) => ({
            id: cat.id,
            name: cat.name,
            imageUrl: cat.image,
        }));

        // Lấy top 20 restaurants sắp xếp theo khoảng cách nếu có lat/lng, ngược lại theo mặc định (mới nhất)
        const restaurantsResult = await this.restaurantService.getAllRestaurants(
            20,
            0,
            '',
            undefined,
            lat,
            lng,
            undefined,
            lat !== undefined && lng !== undefined ? 'DISTANCE' : undefined,
            userId,
        );

        const restaurants = await Promise.all(
            restaurantsResult.map(async (res) => {
                const restaurant = res as typeof res & {
                    deliveryFee?: number;
                    ratingCount?: number | null;
                };

                return {
                    id: restaurant.id,
                    name: restaurant.name,
                    imageUrl: await this.resolveFileUrl(restaurant.image),
                    averageRating: restaurant.averageRating,
                    reviewCount: restaurant.ratingCount ?? 0,
                    deliveryFee: restaurant.deliveryFee,
                    distance: restaurant.distanceKm,
                    tags: restaurant.categories.map(
                        (category: { name: string }) => category.name,
                    ),
                    estimatedDeliveryTime: restaurant.estimatedDeliveryTime,
                    isLiked: restaurant.isLiked ?? false,
                };
            }),
        );

        return {
            user,
            categories,
            restaurants,
            addresses,
            counters,
        };
    }
}
