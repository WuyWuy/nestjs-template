import { Controller, Get, ParseIntPipe, Query , DefaultValuePipe, Param } from "@nestjs/common";
import { FoodService } from "./food.service";

@Controller("food") 
export class FoodController 
{
    constructor(
        private readonly foodService : FoodService
    ) {} 
    @Get()
    async getAllFood(
        @Query("limit" , new DefaultValuePipe(20) , ParseIntPipe) limit : number, 
        @Query("offset" , new DefaultValuePipe(0) , ParseIntPipe) offset : number, 
        @Query("name" , new DefaultValuePipe("")) name : string  
    ) 
    {
        const response = await this.foodService.getAllFood(Number(limit), Number(offset) , name) 
        return response 
    }
    @Get("/:id") 
    async getFoodDetail(
        @Param("id" , ParseIntPipe) id : number 
    ) 
    {
        const food = await this.foodService.getFoodDetail(id) 
        return food 
    }
    
}