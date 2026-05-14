import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";

@Injectable()  
export class RestaurantService 
{
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
    async getRestaurantMenu(restaurantId : number) 
    {
        try 
        {
            const menu = await this.prismaService.menu.findUnique({
                where: {
                    restaurantId, 
                    deleteAt: null, 
                    restaurant: {
                        deleteAt : null 
                    }
                }, 
                select: {
                    foods: {
                        select: {
                            description: true,  
                            id: true, 
                            code: true, 
                            price: true, 
                            image : true, 
                            name : true, 
                        }
                    }
                }
            })
            if (!menu) 
                throw new NotFoundException("Menu not found") 
            return menu 
        } 
        catch (err) 
        {
            console.log("Get restaurant menu error" , err) 
            throw err 
        }
    }
    async getRestaurantInDetail(restaurantId : number) 
    {
        try 
        {
            
            const response = await this.prismaService.restaurant.findFirst({
                where: {
                    id : restaurantId, 
                    deleteAt: null, 
                    approved: true, 
                }, 
                select: {
                    name: true, 
                    image : true, 
                    phone : true, 
                    address: true, 
                }
            })
            if (!response) 
                throw new NotFoundException("restaurant not found") 
            return response
        } 
        catch (err) 
        {
            console.log("Error during get restaurant in detail" , err) 
            throw err 
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