import { PrismaService } from "@/prisma/prisma.service";
import { BadRequestException, Injectable } from "@nestjs/common";
import { MinioService } from "../minio/minio.service";
import { Express } from "express";
@Injectable() 
export class CustomerService 
{
    constructor(
        private readonly prismaService : PrismaService,  
        private readonly minioService : MinioService
    ) {} 
    async uploadImages(file : Express.Multer.File) 
    {
        try 
        {
            const results = await this.minioService.uploadFile(file) 
            console.log("File name: " , results) 
            return results
        } 
        catch (err) 
        {
            console.log("upload file error" , err) 
            throw err 
        }
    }
    async getAllCustomers() 
    {
        try  
        {
            const customers = await this.prismaService.user.findMany({
                select: {
                    id: true, 
                    name: true, 
                    email : true, 
                    phone: true 
                }
            }) 
            return customers 
        } 
        catch (err) 
        {
            console.log("Get customer error" , err) 
            throw err 
        }
    }
    async getCustomerProfile(id : number) 
    {
        try 
        {
            const customer = await this.prismaService.user.findFirst({
                where: { id , active : true }, 
                select: {
                    name: true, 
                    email: true, phone: true, 
                    birthday: true, 
                    avatar: true, //Fix lai la lay avatar 
                    
                }
            })
            if (!customer) 
                throw new BadRequestException("customer not found") 
            const newAvatar = await this.minioService.getFileUrl(customer.avatar) 
            return {
                ...customer, 
                avatar : newAvatar
            }
        } 
        catch (err) 
        {
            console.log("get customer error" , err) 
            throw err 
        }
    }
}