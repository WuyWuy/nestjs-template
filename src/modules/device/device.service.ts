import { Injectable } from "@nestjs/common";
import { RegisterDeviceData } from "./dto/device.dto";
import { PrismaService } from "@/prisma/prisma.service";

@Injectable() 
export class DeviceService 
{
    constructor (
        private readonly prismaService : PrismaService
    ) {} 
    async register(userId : number , registerData : RegisterDeviceData) 
    {
        try 
        {
            const device = await this.prismaService.device.findFirst({
                where: {
                    deviceToken : registerData.deviceToken
                }
            }) 
            if (!device) 
                return await this.prismaService.device.create({
                    data : {
                        deviceToken : registerData.deviceToken, 
                        platform : registerData.platform, 
                        userId 
                    }
                })
            //Neu co roi thi tien hanh upate 
            return await this.prismaService.device.update({
                where: {
                    deviceToken : registerData.deviceToken
                }, 
                data : {
                    ...registerData, 
                    userId 
                }
            })
        } 
        catch (err) 
        {
            console.log("Register Device Erro: " , err) 
            throw err 
        }
    }   
    async findDevicesByUser(userId : number) 
    {
        try 
        {
            const devicesIds = await this.prismaService.device.findMany({
                where: {
                    userId  
                }, 
                select : {
                    deviceToken : true 
                }
            }) 
            return devicesIds.map((devicesId) => devicesId.deviceToken)
        } 
        catch (err) 
        {
            console.log("Find Devices By User Error: " ,err) 
            throw err 
        }
    }
}