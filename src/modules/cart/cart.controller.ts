import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CartService } from "./cart.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Role } from "@prisma/client";
import { RolesGuard } from "@/bases/guards/role.guard";
import { Roles } from "@/bases/decorators/role.decorators";
import { Request } from "express";
import { CreateCartItemDto } from "./dto/cart.dto";

@Roles(Role.CUSTOMER)
@UseGuards(JwtAuthGuard , RolesGuard)
@Controller("cart") 
export class CartController 
{
    constructor(
        private readonly cartService : CartService 
    ) { }
    @Get() 
    async getCartProducts(
        @Query("limit" , ParseIntPipe , new DefaultValuePipe(10)) limit: number, 
        @Query("offset" , ParseIntPipe , new DefaultValuePipe(0)) offset: number 
    ) 
    {
        const response = await this.cartService.getAllProducts(limit , offset) 
        return response 
    }
    @Post() 
    async pushCartItem(
        @Req() req : Request, 
        @Body() createCartItem : CreateCartItemDto
    ) 
    {
        console.log(req) 
        console.log(createCartItem) 
    }
}