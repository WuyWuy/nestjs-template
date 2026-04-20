import { Injectable } from '@nestjs/common';
import { FirebaseService } from './firebase/firebase.service';
// import { PrismaService } from "@/prisma/prisma.service";
import { DeviceService } from '../device/device.service';
import { ResponseBody } from '@/bases/commons/enums/response.enum';

@Injectable()
export class NotificationService {
    constructor(
        private readonly firebaseService: FirebaseService,
        // private readonly prismaService : PrismaService,
        private readonly deviceService: DeviceService,
    ) {}
    async pushNotification(userId: number, title: string, body: string) {
        try {
            const deviceIds =
                await this.deviceService.findDevicesByUser(userId);
            const payload = {
                notification: {
                    title,
                    body,
                },
            };
            for (const deviceToken of deviceIds) {
                await this.firebaseService.sendNotification(
                    deviceToken,
                    payload,
                );
            }
            return {
                [ResponseBody.MESSAGE]:
                    'Notification has been push up to all devices',
            };
        } catch (err) {
            console.log(err);
            throw err;
        }
    }
    //App xin quyền nhận thông báo -> Gửi device Token về cho BE lưu trữ. Sau đó sẽ tiến hành push notification 
    async testPushNotification(deviceToken: string) {
        try {
            const payload = {
                notification: {
                    title: 'Testing website title',
                    body: 'Testing website body',
                },
            };
            await this.firebaseService.sendNotification(deviceToken, payload);
            return {
                [ResponseBody.MESSAGE]:
                    'Notification has been push up to all devices',
            };
        } catch (err) {
            console.log(err);
            throw err;
        }
    }
}
