import { Injectable } from "@nestjs/common";
import { FirebaseService } from "./firebase/firebase.service";
// import { PrismaService } from "@/prisma/prisma.service";
import { DeviceService } from "../device/device.service";

@Injectable()
export class NotificationService  
{
    constructor(
        private readonly firebaseService : FirebaseService, 
        // private readonly prismaService : PrismaService, 
        private readonly deviceService : DeviceService
    ) {} 
    async pushNotification(userId : number , title : string , body : string) 
    {
        try 
        {
            const deviceIds = await this.deviceService.findDevicesByUser(userId)
            const payload = {
                notification : {
                    title, 
                    body 
                }
            }
            for (const deviceToken of deviceIds)
            {
                await this.firebaseService.sendNotification(deviceToken , payload)
            }
            return {
                message : "Notification has been push up to all devices" 
            }
        } 
        catch (err) 
        {
            console.log(err) 
            throw err 
        }
    }
}