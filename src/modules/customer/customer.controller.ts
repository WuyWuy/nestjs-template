import { Controller, Get, Post, Req, UnauthorizedException, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import type { Express , Request } from "express";
import { FileInterceptor } from '@nestjs/platform-express';
import { CustomerService } from "./customer.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "@/bases/guards/role.guard";
import { Roles } from "@/bases/decorators/role.decorators";
import { Role } from "@prisma/client";

@Controller("customer") 
export class CustomerController 
{
    constructor(
        private readonly customerService : CustomerService
    ) {} 
    @Post() 
    @UseInterceptors(FileInterceptor('data'))
    async uploadImage(
        @UploadedFile() file: Express.Multer.File 
    ) 
    {
        const results = await this.customerService.uploadImages(file) 
        return results
    }
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard , RolesGuard)

    @Get() 
    async getAllCustomers() 
    {
        const responseData = await this.customerService.getAllCustomers() 
        return responseData
    }
    @Get("/profile") 
    async getProfile(
        @Req() req : Request 
    ) 
    {
        const id = (req.user as any).id 
        if (!id) 
            throw new UnauthorizedException("Invalid Token") //Login again 
        const responseData = await this.customerService.getCustomerProfile(Number(id)) 
        return responseData

    }
    @Post("address") 
    async addAddress() 
    {
        
    }
}