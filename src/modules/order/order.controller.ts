import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { OrderService } from "./order.service";
import { CreateOrderDto } from "./dto/order.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "@/bases/guards/role.guard";
import { Roles } from "@/bases/decorators/role.decorators";
import { Role } from "@prisma/client";
import type { Request } from "express";


@Controller() 
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
}