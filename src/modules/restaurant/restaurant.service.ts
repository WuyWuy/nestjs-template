import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()  
export class RestaurantService 
{
    constructor(
        private readonly prismaService : PrismaService
    ) {} 
    async getAllRestaurants(limit : number , offset : number , name : string , phone : string) 
    {    
        try 
        {
            const restaurants = await this.prismaService.client.restaurant.findMany({
                where: {
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
            const menu = await this.prismaService.client.menu.findUnique({
                where: {
                    restaurantId, 
                    restaurant: {
                        deleteAt : null 
                    }
                }, 
                select: {
                    foods: {
                        select: {
                            description: true,  
                            id: true, 
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
            
            const response = await this.prismaService.client.restaurant.findFirst({
                where: {
                    id : restaurantId, 
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
}