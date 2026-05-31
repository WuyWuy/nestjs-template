import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { FirebaseService } from './firebase/firebase.service';
import { DeviceService } from '../device/device.service';
import { ResponseBody } from '@/bases/commons/enums/response.enum';
import { NotificationQueryDto } from './dto/notification.dto';

@Injectable()
export class NotificationService {
    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly deviceService: DeviceService,
        private readonly prismaService: PrismaService,
    ) {}

    async createNotification(
        userId: number,
        title: string,
        body: string,
        type: NotificationType = NotificationType.SYSTEM,
    ) {
        const notification = await this.prismaService.client.notification.create({
            data: {
                userId,
                title,
                body,
                type,
            },
        });

        return notification;
    }

    async pushNotification(
        userId: number,
        title: string,
        body: string,
        type: NotificationType = NotificationType.SYSTEM,
    ) {
        const notification = await this.createNotification(
            userId,
            title,
            body,
            type,
        );

        const deviceIds = await this.deviceService.findDevicesByUser(userId);
        const payload = {
            notification: {
                title,
                body,
            },
            data: {
                notificationId: String(notification.id),
                type,
            },
        };

        for (const deviceToken of deviceIds) {
            await this.firebaseService.sendNotification(deviceToken, payload);
        }

        return {
            [ResponseBody.MESSAGE]:
                'Notification has been pushed to all registered devices',
            notification,
        };
    }

    async getMyNotifications(userId: number, query: NotificationQueryDto) {
        return await this.prismaService.client.notification.findMany({
            where: {
                userId,
                type: query.type,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: query.limit ?? 20,
            skip: query.offset ?? 0,
        });
    }

    async markAsRead(userId: number, notificationId: number) {
        const notification = await this.prismaService.client.notification.findFirst(
            {
                where: {
                    id: notificationId,
                    userId,
                },
            },
        );

        if (!notification) {
            throw new NotFoundException('Notification not found');
        }

        return await this.prismaService.client.notification.update({
            where: {
                id: notificationId,
            },
            data: {
                readAt: new Date(),
            },
        });
    }

    async markAllAsRead(userId: number) {
        await this.prismaService.client.notification.updateMany({
            where: {
                userId,
                readAt: null,
            },
            data: {
                readAt: new Date(),
            },
        });

        return {
            message: 'All notifications marked as read',
        };
    }

    async testPushNotification(deviceToken: string) {
        const payload = {
            notification: {
                title: 'Testing website title',
                body: 'Testing website body',
            },
        };
        await this.firebaseService.sendNotification(deviceToken, payload);
        return {
            [ResponseBody.MESSAGE]:
                'Notification has been pushed to the test device',
        };
    }
}
