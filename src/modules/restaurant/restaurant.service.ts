import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { RestaurantStatsDto } from './dto/restaurant-stats.dto';
import { CreateReviewDto } from './dto/review.dto';

@Injectable()
export class RestaurantService {
    constructor(private readonly prismaService: PrismaService) {}
    // IMPORTANT: This service returns aggregated metrics scoped to a single
    // restaurant. Current implementation returns simple totals (orders, revenue,
    // rating average, counts). If FE requires time-series (day/week/month)
    // please update the method to accept `from`, `to`, and `granularity` params
    // and coordinate on the exact DTO shape.
    //
    // Notes for reviewers:
    // - Soft-delete: queries filter on `deleteAt: null` to ignore soft-deleted
    //   records. Make sure this aligns with product expectations.
    // - Timezone: server works in UTC. If FE provides a date range, convert it
    //   consistently (or provide timezone in request).
    async getAllRestaurants(
        limit: number,
        offset: number,
        name: string,
        phone: string,
    ) {
        try {
            const restaurants =
                await this.prismaService.client.restaurant.findMany({
                    where: {
                        approved: true,
                        name: {
                            contains: name,
                            mode: 'insensitive',
                        },
                        phone: {
                            contains: phone,
                            mode: 'insensitive',
                        },
                    },
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        phone: true,
                    },
                    take: limit,
                    skip: offset,
                });
            return restaurants;
        } catch (err) {
            console.log('Get all restaurant error', err);
            throw err;
        }
    }
    async getRestaurantMenu(restaurantId: number) {
        try {
            const foods = await this.prismaService.client.food.findMany({
                where: {
                    restaurantId,
                    deleteAt: null,
                },
                select: {
                    description: true,
                    id: true,
                    price: true,
                    image: true,
                    name: true,
                },
            });
            return { foods };
        } catch (err) {
            console.log('Get restaurant menu error', err);
            throw err;
        }
    }
    async getRestaurantInDetail(restaurantId: number) {
        try {
            const response =
                await this.prismaService.client.restaurant.findFirst({
                    where: {
                        id: restaurantId,
                        approved: true,
                    },
                    select: {
                        name: true,
                        image: true,
                        phone: true,
                        address: true,
                    },
                });
            if (!response) throw new NotFoundException('restaurant not found');
            return response;
        } catch (err) {
            console.log('Error during get restaurant in detail', err);
            throw err;
        }
    }

    /**
        * Lấy thông tin cơ bản của nhà hàng dùng cho listing/preview
        * Trả về object với cấu trúc:
        * {
        *   id, name, image, phone, address, averageRating
        * }
        * - `averageRating` là số thực (float) đại diện cho điểm trung bình
        *   của các review (trả về 0 nếu chưa có review)
        * - Hàm lọc các bản ghi đã bị xóa mềm (deleteAt != null)
        * - Nếu không tìm thấy nhà hàng sẽ ném `NotFoundException` (404)
        */
    async getRestaurantBasic(restaurantId: number) {
        try {
            // Kiểm tra tồn tại
            const rest = await this.prismaService.client.restaurant.findFirst({
                where: { id: restaurantId, deleteAt: null },
                select: { id: true, name: true, image: true, phone: true, address: true },
            });
            if (!rest) throw new NotFoundException('Restaurant not found');

            // Tính điểm trung bình
            const ratingStats = await this.prismaService.client.restaurantRating.aggregate({
                where: { restaurantId, deleteAt: null },
                _avg: { vote: true },
            });

            return {
                id: rest.id,
                name: rest.name,
                image: rest.image,
                phone: rest.phone,
                address: rest.address,
                averageRating: ratingStats._avg.vote || 0,
            };
        } catch (err) {
            console.error('Error during getRestaurantBasic', err);
            throw err;
        }
    }

    async getRestaurantStats(restaurantId: number): Promise<RestaurantStatsDto> {
        try {
            // Kiểm tra restaurant tồn tại
            const restaurant = await this.prismaService.client.restaurant.findUnique({
                where: { id: restaurantId, deleteAt: null },
                select: { id: true }
            });
            if (!restaurant) throw new NotFoundException('Restaurant not found');

            // Tính totalOrders và totalRevenue
            // NOTE: _sum on Decimal fields returns Prisma.Decimal. We convert
            // to number on the return path below to simplify FE consumption.
            const orderStats = await this.prismaService.client.order.aggregate({
                where: { restaurantId, deleteAt: null },
                _count: { id: true },
                _sum: { totalPrice: true }
            });

            // Tính averageRating và totalRatings
            const ratingStats = await this.prismaService.client.restaurantRating.aggregate({
                where: { restaurantId, deleteAt: null },
                _count: { id: true },
                _avg: { vote: true }
            });

            // Tính totalFoods
            const foodCount = await this.prismaService.client.food.count({
                where: { restaurantId, deleteAt: null }
            });

            return {
                totalOrders: orderStats._count.id,
                // Convert Decimal -> number for client ease. If very large values
                // or precision matters, return as string instead and let FE cast.
                totalRevenue: orderStats._sum.totalPrice?.toNumber() || 0,
                averageRating: ratingStats._avg.vote || 0,
                totalRatings: ratingStats._count.id,
                totalFoods: foodCount
            };
        } catch (err) {
            console.log('Error during get restaurant stats', err);
            throw err;
        }
    }

    /**
     * Tạo và lưu review cho nhà hàng
     * Kiểm tra:
     * - Nhà hàng tồn tại
     * - User đã order từ nhà hàng này
     * - User chưa review nhà hàng này rồi
     * 
     * @param userId - ID khách hàng (từ JWT)
     * @param restaurantId - ID nhà hàng cần review
     * @param data - DTO chứa vote (1-5) và comment
     * @returns Object chứa message và review đã tạo
     */
    async createReview(
        userId: number,
        restaurantId: number,
        data: CreateReviewDto,
    ) {
        try {
            // 1️⃣ Kiểm tra nhà hàng tồn tại
            const restaurant = await this.prismaService.client.restaurant.findFirst({
                where: {
                    id: restaurantId,
                    deleteAt: null,
                },
            });
            if (!restaurant) {
                throw new NotFoundException('Restaurant not found or has been deleted');
            }

            // 2️⃣ Kiểm tra user đã order từ nhà hàng này chưa
            // (User phải có ít nhất 1 order từ nhà hàng mới được review)
            const userOrder = await this.prismaService.client.order.findFirst({
                where: {
                    userId,
                    restaurantId,
                    deleteAt: null,
                },
            });
            if (!userOrder) {
                throw new BadRequestException(
                    'You must have at least one order from this restaurant to leave a review',
                );
            }

            // 3️⃣ Kiểm tra user chưa review nhà hàng này rồi
            // (Mỗi user chỉ được review 1 lần cho mỗi nhà hàng)
            const existingReview = await this.prismaService.client.restaurantRating.findFirst({
                where: {
                    userId,
                    restaurantId,
                    deleteAt: null,
                },
            });
            if (existingReview) {
                throw new BadRequestException(
                    'You have already reviewed this restaurant',
                );
            }

            // 4️⃣ Tạo review mới trong database
            const review = await this.prismaService.client.restaurantRating.create({
                data: {
                    userId,
                    restaurantId,
                    vote: data.vote,
                    comment: data.comment || '', // Nếu không có comment, lưu string rỗng
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    restaurant: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            // 5️⃣ Trả về kết quả
            return {
                message: 'Review created successfully',
                review: {
                    id: review.id,
                    restaurantId: review.restaurantId,
                    restaurant: review.restaurant,
                    userId: review.userId,
                    user: review.user,
                    vote: review.vote,
                    comment: review.comment,
                    createdAt: review.createdAt,
                },
            };
        } catch (err) {
            console.error('Create review error:', err);
            throw err;
        }
    }

    /**
     * Lấy danh sách review của nhà hàng
     * 
     * @param restaurantId - ID nhà hàng
     * @param limit - Số review trên mỗi trang (mặc định 10)
     * @param offset - Vị trí bắt đầu (dùng cho phân trang)
     * @returns Object chứa danh sách review và thông tin phân trang
     */
    async getRestaurantReviews(
        restaurantId: number,
        limit: number = 10,
        offset: number = 0,
    ) {
        try {
            // 1️⃣ Kiểm tra nhà hàng tồn tại
            const restaurant = await this.prismaService.client.restaurant.findFirst({
                where: {
                    id: restaurantId,
                    deleteAt: null,
                },
                select: { id: true }
            });
            if (!restaurant) {
                throw new NotFoundException('Restaurant not found or has been deleted');
            }

            // 2️⃣ Lấy danh sách review của nhà hàng
            const reviews = await this.prismaService.client.restaurantRating.findMany({
                where: {
                    restaurantId,
                    deleteAt: null, // Chỉ lấy review chưa bị xóa mềm
                },
                select: {
                    id: true,
                    vote: true,
                    comment: true,
                    createdAt: true,
                    // Thông tin người review
                    user: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    // Sắp xếp review mới nhất trước
                    createdAt: 'desc',
                },
                take: limit,
                skip: offset,
            });

            // 3️⃣ Đếm tổng số review
            const total = await this.prismaService.client.restaurantRating.count({
                where: {
                    restaurantId,
                    deleteAt: null,
                },
            });

            // 4️⃣ Tính điểm trung bình review
            const ratingStats = await this.prismaService.client.restaurantRating.aggregate({
                where: {
                    restaurantId,
                    deleteAt: null,
                },
                _avg: { vote: true },
            });

            // 5️⃣ Trả về danh sách review và thống kê
            return {
                data: reviews,
                statistics: {
                    totalReviews: total,
                    averageRating: ratingStats._avg.vote || 0,
                },
                pagination: {
                    total,
                    limit,
                    offset,
                },
            };
        } catch (err) {
            console.error('Get restaurant reviews error:', err);
            throw err;
        }
    }
}
