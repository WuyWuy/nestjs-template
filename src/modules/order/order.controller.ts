import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { OrderService } from "./order.service";
import { CreateOrderDto } from "./dto/order.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "@/bases/guards/role.guard";
import { Roles } from "@/bases/decorators/role.decorators";
import { Role } from "@prisma/client";
import type { Request } from "express";


@Controller("orders") 
@Roles(Role.CUSTOMER)
@UseGuards(JwtAuthGuard , RolesGuard)
export class OrderController 
{
    constructor(
        private readonly orderSerivce : OrderService
    ) {}
    @Post() 
    async createOrder(
        @Body() data : CreateOrderDto, 
        @Req() req : Request 
    ) 
    {
        const userId = (req.user as any).id 
        const response = await this.orderSerivce.createOrder(Number(userId) , data)
        return response 
    }
    @Get() 
    async getAllUSerPayment(
        @Query("limit" , new DefaultValuePipe(20) , ParseIntPipe) limit : number, 
        @Query("offset" , new DefaultValuePipe(0) , ParseIntPipe) offset : number, 
    ) 
    {
        const response = await this.orderSerivce.getAllOrders(limit , offset) 
        return response 
    }
}