import { PrismaService } from "@/prisma/prisma.service";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable() 
export class FoodService 
{
    constructor(
        private readonly prismaService : PrismaService 
    ) {} 
    async getAllFood(limit : number , offset : number , name : string) 
    {
        try 
        {
            const foods = await this.prismaService.food.findMany({
                take : limit, 
                skip : offset, 
                where: {
                    deleteAt: null, 
                    name: {
                        contains: name, 
                        mode: 'insensitive'
                    }
                }, 
                select: {
                    id : true, 
                    name : true, 
                    code : true, 
                    description: true, 
                    price: true, 
                    image: true, 
                    rating : true, 
                    menuId : true, 
                    label : true, 
                    category : {
                        select: {
                            name : true, 
                            id : true, 
                        }
                    }
                }
            })
            return foods; 
        } 
        catch (err) 
        {
            console.log("Get all food error: " , err) 
            throw err 
        }
    }
    async getFoodDetail(id : number) 
    {
        try 
        {
            const food = await this.prismaService.food.findFirst({
                where : { id  , deleteAt : null}, 
                select : {
                    id : true, 
                    name : true, 
                    price : true, 
                    image : true, 
                    rating : true, 
                    label : true, 
                    category: {
                        select: {
                            id : true, 
                            name : true 
                        }
                    }, 
                    menu : {
                        select: {
                            restaurant : {
                                select : { name : true }
                            }
                        }
                    },  
                    foodIngredients: {
                        select: {
                            ingredient : {
                                select : { id : true,  name : true , icon : true }
                            }
                        }
                    }, 

                }
            })
            if (!food) 
                throw new NotFoundException("Food not found") 
            const takeFood = {
                ...food, 
                menu : {
                    restaurant : food.menu.restaurant, 
                    
                }, 
                foodIngredients : food.foodIngredients.map((ingredient) => {
                return {...ingredient.ingredient}
            })
            }
            return takeFood
        } 
        catch (err) 
        {
            console.log("Get food detail error" , err) 
            throw err 
        }
    }
}