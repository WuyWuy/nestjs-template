import { Injectable } from "@nestjs/common";
import { CreateAddressDto } from "./dto/address.dto";
import { PrismaService } from "@/prisma/prisma.service";

@Injectable() 
export class AddressService 
{
    constructor(
        private readonly prismaService : PrismaService
    ) {} 
    async createAddress(address : CreateAddressDto) 
    {
        try 
        {
            const result = await this.prismaService.$transaction(async (tx) => {
                const existsAddress = await tx.address.findFirst({
                    where: {
                        longitude: {
                            gte: address.longitude - 0.0001, 
                            lte: address.longitude + 0.0001 
                        }, 
                        latitude: {
                            gte: address.latitude - 0.0001, 
                            lte : address.latitude + 0.0001 
                        }
                    }
                })
                if (existsAddress) return existsAddress 
                const address1 = await tx.address.create({
                    data: {
                        ...address
                    }
                })
                return address1
            }) 
            return result
        } 
        catch (err) {
            console.log("create address error" , err) 
            throw err 
        }
    }
}