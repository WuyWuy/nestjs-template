import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, DeliveryChannel, DeliveryStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { FirebaseService } from './firebase/firebase.service';
import { DeviceService } from '../device/device.service';
import { ResponseBody } from '@/bases/commons/enums/response.enum';
import { NotificationQueryDto } from './dto/notification.dto';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEvent } from './events/notification.event';

@Injectable()
export class NotificationService {
    constructor(
        private readonly firebaseService: FirebaseService,
        private readonly deviceService: DeviceService,
        private readonly prismaService: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

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
        // Emit the event to delegate notification handling asynchronously
        this.eventEmitter.emit('notification.send', {
            recipientUserId: userId,
            title,
            body,
            type,
            channels: [DeliveryChannel.IN_APP, DeliveryChannel.DEVICE],
        } as NotificationEvent);

        return {
            [ResponseBody.MESSAGE]:
                'Notification has been pushed to all registered devices',
        };
    }


    //he thong listener cua event ben trong du an (Chac vay)
    @OnEvent('notification.send')
    async handleNotificationSendEvent(event: NotificationEvent) {
        try {
            const recipientUserId = event.recipientUserId;
            const title = event.title;
            const body = event.body;
            const type = event.type;
            const channels = event.channels || [DeliveryChannel.IN_APP, DeliveryChannel.DEVICE];
            const targetType = event.targetType || null;
            const targetId = event.targetId || null;
            const actorId = event.actorId || null;
            const metadata = event.metadata || null;

            // 1. Create parent Notification
            const notification = await this.prismaService.client.notification.create({
                data: {
                    userId: recipientUserId,
                    title,
                    body,
                    type,
                    targetType,
                    targetId,
                    actorId,
                    metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
                },
            });

            // 2. Process channels
            for (const channel of channels) {
                if (channel === DeliveryChannel.IN_APP) {
                    await this.prismaService.client.notificationChannel.create({
                        data: {
                            notificationId: notification.id,
                            channel: DeliveryChannel.IN_APP,
                            status: DeliveryStatus.SENT,
                            sentAt: new Date(),
                        },
                    });
                } else if (channel === DeliveryChannel.DEVICE) {
                    const channelRecord = await this.prismaService.client.notificationChannel.create({
                        data: {
                            notificationId: notification.id,
                            channel: DeliveryChannel.DEVICE,
                            status: DeliveryStatus.PENDING,
                        },
                    });

                    try {
                        const deviceIds = await this.deviceService.findDevicesByUser(recipientUserId);
                        if (deviceIds.length === 0) {
                            await this.prismaService.client.notificationChannel.update({
                                where: { id: channelRecord.id },
                                data: {
                                    status: DeliveryStatus.SKIPPED,
                                },
                            });
                        } else {
                            const payload = {
                                notification: { title, body },
                                data: {
                                    notificationId: String(notification.id),
                                    type,
                                    targetType: targetType || '',
                                    targetId: targetId ? String(targetId) : '',
                                    actorId: actorId ? String(actorId) : '',
                                    metadata: metadata ? JSON.stringify(metadata) : '',
                                },
                            };

                            let anySuccess = false;
                            let lastError: string | null = null;
                            const providerResults: any[] = [];

                            for (const deviceToken of deviceIds) {
                                try {
                                    const firebaseRes = await this.firebaseService.sendNotification(deviceToken, payload);
                                    anySuccess = true;
                                    providerResults.push({ deviceToken, success: true, result: firebaseRes });
                                } catch (err: any) {
                                    lastError = err?.message || String(err);
                                    providerResults.push({ deviceToken, success: false, error: lastError });
                                }
                            }

                            if (anySuccess) {
                                await this.prismaService.client.notificationChannel.update({
                                    where: { id: channelRecord.id },
                                    data: {
                                        status: DeliveryStatus.SENT,
                                        sentAt: new Date(),
                                        providerResult: providerResults ? JSON.parse(JSON.stringify(providerResults)) : null,
                                    },
                                });
                            } else {
                                await this.prismaService.client.notificationChannel.update({
                                    where: { id: channelRecord.id },
                                    data: {
                                        status: DeliveryStatus.FAILED,
                                        failedAt: new Date(),
                                        error: lastError || 'Firebase delivery failed for all devices',
                                        providerResult: providerResults ? JSON.parse(JSON.stringify(providerResults)) : null,
                                    },
                                });
                            }
                        }
                    } catch (err: any) {
                        await this.prismaService.client.notificationChannel.update({
                            where: { id: channelRecord.id },
                            data: {
                                status: DeliveryStatus.FAILED,
                                failedAt: new Date(),
                                error: err?.message || String(err),
                            },
                        });
                    }
                }
            }
        } catch (err) {
            console.error('Error in handleNotificationSendEvent:', err);
        }
    }

    async getMyNotifications(userId: number, query: NotificationQueryDto) {
        const whereClause: any = {
            userId,
            deleteAt: null,
        };

        if (query.type) {
            whereClause.type = query.type;
        }

        if (query.read === 'true') {
            whereClause.readAt = { not: null };
        } else if (query.read === 'false') {
            whereClause.readAt = null;
        }

        return await this.prismaService.client.notification.findMany({
            where: whereClause,
            include: {
                channels: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: query.limit ?? 20,
            skip: query.offset ?? 0,
        });
    }

    async getUnreadCount(userId: number) {
        const count = await this.prismaService.client.notification.count({
            where: {
                userId,
                readAt: null,
                deleteAt: null,
            },
        });
        return { count };
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

    async testPushNotification(userId: number) {
        try {
            this.eventEmitter.emit('notification.send', {
                recipientUserId: userId,
                title: 'Test push notification',
                body: 'This is a test push notification',
                type: NotificationType.SYSTEM,
                channels: [DeliveryChannel.DEVICE],
            } as NotificationEvent);

            return {
                [ResponseBody.MESSAGE]:
                    'Test notification event has been emitted',
            };
        }
        catch (err) {
            console.log("Push notification error: ", err)
            throw err
        }
    }
}
