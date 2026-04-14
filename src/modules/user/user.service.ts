import { PrismaService } from "@/prisma/prisma.service";
import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { MinioService } from "../minio/minio.service";
import { Express } from "express";
import { AddUserAddressDto, UpdateUserProfileDto } from "./dto/user.dto";
import { AddressService } from "../address/address.service";
@Injectable() 
export class UserService 
{
    constructor(
        private readonly prismaService : PrismaService,  
        private readonly minioService : MinioService, 
        private readonly addressService : AddressService
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
    async getAllUsers() 
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
    async getUserProfile(id : number) 
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
    async updateUserProfile(id : number , data : UpdateUserProfileDto , file : Express.Multer.File) 
    {
        try 
        {
            const user = await this.getUserById(id) 
            if (!user) 
                throw new BadRequestException("user not found") 
            const result = await this.prismaService.$transaction(async (tx) => {
                let avatar = user.avatar
                if (file) 
                {
                    avatar = await this.minioService.uploadFile(file) 
                } 
                const nuser = await tx.user.update({
                    where: { id }, 
                    data: {
                        ...data, 
                        avatar 
                    }
                })
                return nuser
            })
            return result
        } 
        catch (err) 
        {
            console.log("update user profile error" , err) 
            throw err 
        }
    }
    async getUserById(id : number ) 
    {
        const user = await this.prismaService.user.findFirst({
            where: {
                id 
            }
        })
        return user 
    }
    async addUserAddress(userId : number , address : AddUserAddressDto) 
    {
        try 
        {
            const user = await this.getUserById(userId) 
            if (!user) 
                throw new UnauthorizedException("user not found") 
            const result = await this.prismaService.$transaction(async (tx) => {
                const crAddress = await this.addressService.createAddress(address.address)
                const respo = await tx.userAddress.create({
                    data: {
                        title : address.title, 
                        addressId : crAddress.id, 
                        userId : userId
                    }
                })
                return respo
            })
            return result
        } 
        catch (err) 
        {
            console.log("add user address error" , err) 
            throw err 
        }
    }
    async getAllAddress(userId : number) 
    {
        try {
            const user = await this.getUserById(userId) 
            if (!user) 
                throw new UnauthorizedException("user not found") 
            const addresses = await this.prismaService.userAddress.findMany({
                where: { userId : 1}, 
                select: {
                    title : true, 
                    address: true 
                }
            })
            return addresses
        } 
        catch (err) 
        {
            console.log('get all address error' , err) 
            throw err
        }
    }
}