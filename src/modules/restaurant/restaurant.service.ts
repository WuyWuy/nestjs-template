import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";

type RestaurantUploadFiles = {
    image?: Express.Multer.File[];
    coverImage?: Express.Multer.File[];
};

@Injectable()
export class RestaurantService {
    constructor(
        private readonly prismaService : PrismaService
    ) {} 

    /**
     * Get all approved restaurants (for customers)
     */
    async getAllRestaurants(limit : number , offset : number , name : string , phone : string) 
    {    
        try 
        {
            const restaurants = await this.prismaService.restaurant.findMany({
                where: {
                    deleteAt : null, 
                    approved: true, 
                    name: {
                        contains : name,  
                        mode: 'insensitive'
                    }, 
                    phone: {
                        contains : phone, 
                        mode : 'insensitive'
                    }
                }, 
                select: {
                    id : true, 
                    name : true,  
                    image: true, 
                    code : true, 
                    phone : true, 
                }, 
                take : limit, 
                skip : offset, 
                
            })
            return restaurants 
        } 
        catch (err) 
        {
            console.log("Get all restaurant error" , err) 
            throw err 
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

    /**
     * Get pending restaurant registrations (admin only)
     */
    async getPendingRegistrations(limit: number = 20, offset: number = 0) {
        try {
            const pendingRestaurants = await this.prismaService.restaurant.findMany({
                where: {
                    approved: false,
                    deleteAt: null,
                },
                select: {
                    id: true,
                    code: true,
                    name: true,
                    phone: true,
                    image: true,
                    owner: {
                        select: {
                            id: true,
                            email: true,
                            phone: true,
                        },
                    },
                    address: {
                        select: {
                            id: true,
                            street: true,
                            ward: true,
                            district: true,
                            city: true,
                        },
                    },
                    createdAt: true,
                    rejectionReason: true,
                },
                take: limit,
                skip: offset,
                orderBy: {
                    createdAt: 'desc',
                },
            });

            const total = await this.prismaService.restaurant.count({
                where: {
                    approved: false,
                    deleteAt: null,
                },
            });

            return {
                data: pendingRestaurants,
                total,
                limit,
                offset,
            };
        } catch (err) {
            console.log("Get pending registrations error", err);
            throw err;
        }
    }

    /**
     * Approve restaurant registration (admin only)
     */
    async approveRestaurant(restaurantId: number) {
        try {
            const restaurant = await this.prismaService.restaurant.findUnique({
                where: { id: restaurantId },
            });

            if (!restaurant) {
                throw new NotFoundException("Restaurant not found");
            }

            if (restaurant.approved) {
                throw new BadRequestException("Restaurant is already approved");
            }

            const updated = await this.prismaService.restaurant.update({
                where: { id: restaurantId },
                data: {
                    approved: true,
                    rejectionReason: null,
                },
                select: {
                    id: true,
                    code: true,
                    name: true,
                    approved: true,
                },
            });

            return {
                message: "Restaurant approved successfully",
                data: updated,
            };
        } catch (err) {
            console.log("Approve restaurant error", err);
            throw err;
        }
    }

    /**
     * Reject restaurant registration (admin only)
     */
    async rejectRestaurant(restaurantId: number, rejectionReason: string) {
        try {
            const restaurant = await this.prismaService.restaurant.findUnique({
                where: { id: restaurantId },
            });

            if (!restaurant) {
                throw new NotFoundException("Restaurant not found");
            }

            if (restaurant.approved) {
                throw new BadRequestException("Cannot reject an already approved restaurant");
            }

            const updated = await this.prismaService.restaurant.update({
                where: { id: restaurantId },
                data: {
                    approved: false,
                    rejectionReason,
                },
                select: {
                    id: true,
                    code: true,
                    name: true,
                    approved: true,
                    rejectionReason: true,
                },
            });

            return {
                message: "Restaurant rejected successfully",
                data: updated,
            };
        } catch (err) {
            console.log("Reject restaurant error", err);
            throw err;
        }
    }
}
