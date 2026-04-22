import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ConversationService } from "./conversation.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { Request } from "express";
import { RolesGuard } from "@/bases/guards/role.guard";
import { Roles } from "@/bases/decorators/role.decorators";
import { Role } from "@prisma/client";
import { CreateConversationDto } from "./dto/conversation.dto";

@Controller("conversation") 
export class ConversationController 
{
    constructor(
        private readonly conversationService : ConversationService
    ) {} 
    @Get("/user/:userId")
    async getAllUsersConversations(
        @Param("userId" , ParseIntPipe) userId : number 
    ) 
    {
        const response = await this.conversationService.getAllUserConversation(Number(userId)) 
        return response 
    }  
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard , RolesGuard)
    @Post() 
    async createConversation(
        @Req() req : Request, 
        @Body() createConversation : CreateConversationDto
    ) 
    {
        const id = (req.user as any).id 
        const response = await this.conversationService.createConversation(Number(id) , createConversation) 
        return response
    }
    @UseGuards(JwtAuthGuard)
    @Get("detail")
    async getConversationDetailById(
        @Query('orderId' , ParseIntPipe) orderId : number, 
        @Query('limit' , ParseIntPipe) limit : number = 20, 
        @Query('offset' , ParseIntPipe) offset : number = 0, 
        @Req() req : Request
    ) 
    {
        const userId = (req.user as any).id 
        const response = await this.conversationService.getConversationByOrderId(userId , orderId , limit , offset)
        return response
    }
    
}