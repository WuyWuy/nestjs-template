jest.mock('@prisma/client', () => ({
    NotificationType: {
        SYSTEM: 'SYSTEM',
        ORDER: 'ORDER',
    },
    DeliveryChannel: {
        IN_APP: 'IN_APP',
        DEVICE: 'DEVICE',
    },
    DeliveryStatus: {
        SENT: 'SENT',
        PENDING: 'PENDING',
        SKIPPED: 'SKIPPED',
        FAILED: 'FAILED',
    },
    Prisma: {
        defineExtension: jest.fn((extension) => extension),
        getExtensionContext: jest.fn(),
        TransactionIsolationLevel: {},
    },
    PrismaClient: class {
        $extends() {
            return this;
        }
    },
}));

import { NotFoundException } from '@nestjs/common';
import {
    DeliveryChannel,
    DeliveryStatus,
    NotificationType,
} from '@prisma/client';
import { ResponseBody } from '@/bases/commons/enums/response.enum';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
    let service: NotificationService;
    let firebaseService: { sendNotification: jest.Mock };
    let deviceService: { findDevicesByUser: jest.Mock };
    let prismaService: any;
    let eventEmitter: { emit: jest.Mock };

    beforeEach(() => {
        firebaseService = {
            sendNotification: jest.fn(),
        };
        deviceService = {
            findDevicesByUser: jest.fn(),
        };
        prismaService = {
            client: {
                notification: {
                    create: jest.fn(),
                    findMany: jest.fn(),
                    count: jest.fn(),
                    findFirst: jest.fn(),
                    update: jest.fn(),
                    updateMany: jest.fn(),
                },
                notificationChannel: {
                    create: jest.fn(),
                    update: jest.fn(),
                },
            },
            notification: {
                delete: jest.fn(),
            },
        };
        eventEmitter = {
            emit: jest.fn(),
        };

        service = new NotificationService(
            firebaseService as any,
            deviceService as any,
            prismaService,
            eventEmitter as any,
        );
    });

    it('should create an in-app notification', async () => {
        const notification = { id: 1, userId: 99 };
        prismaService.client.notification.create.mockResolvedValueOnce(notification);

        const result = await service.createNotification(
            99,
            'Order update',
            'Your order is ready',
            NotificationType.ORDER,
        );

        expect(prismaService.client.notification.create).toHaveBeenCalledWith({
            data: {
                userId: 99,
                title: 'Order update',
                body: 'Your order is ready',
                type: NotificationType.ORDER,
            },
        });
        expect(result).toEqual(notification);
    });

    it('should emit notification send event when pushing notification', async () => {
        const result = await service.pushNotification(
            99,
            'Order update',
            'Your order is ready',
            NotificationType.ORDER,
        );

        expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', {
            recipientUserId: 99,
            title: 'Order update',
            body: 'Your order is ready',
            type: NotificationType.ORDER,
            channels: [DeliveryChannel.IN_APP, DeliveryChannel.DEVICE],
        });
        expect(result).toEqual({
            [ResponseBody.MESSAGE]:
                'Notification has been pushed to all registered devices',
        });
    });

    it('should create sent in-app delivery channel when handling event', async () => {
        prismaService.client.notification.create.mockResolvedValueOnce({ id: 1 });
        prismaService.client.notificationChannel.create.mockResolvedValueOnce({
            id: 10,
        });

        await service.handleNotificationSendEvent({
            recipientUserId: 99,
            title: 'Hello',
            body: 'World',
            type: NotificationType.SYSTEM,
            channels: [DeliveryChannel.IN_APP],
            targetType: 'ORDER',
            targetId: 7,
            actorId: 3,
            metadata: { deep: { ok: true } },
        });

        expect(prismaService.client.notification.create).toHaveBeenCalledWith({
            data: {
                userId: 99,
                title: 'Hello',
                body: 'World',
                type: NotificationType.SYSTEM,
                targetType: 'ORDER',
                targetId: 7,
                actorId: 3,
                metadata: { deep: { ok: true } },
            },
        });
        expect(prismaService.client.notificationChannel.create).toHaveBeenCalledWith({
            data: {
                notificationId: 1,
                channel: DeliveryChannel.IN_APP,
                status: DeliveryStatus.SENT,
                sentAt: expect.any(Date),
            },
        });
    });

    it('should mark device channel as skipped when user has no devices', async () => {
        prismaService.client.notification.create.mockResolvedValueOnce({ id: 1 });
        prismaService.client.notificationChannel.create.mockResolvedValueOnce({
            id: 10,
        });
        deviceService.findDevicesByUser.mockResolvedValueOnce([]);

        await service.handleNotificationSendEvent({
            recipientUserId: 99,
            title: 'Hello',
            body: 'World',
            type: NotificationType.SYSTEM,
            channels: [DeliveryChannel.DEVICE],
        });

        expect(prismaService.client.notificationChannel.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: {
                status: DeliveryStatus.SKIPPED,
            },
        });
        expect(firebaseService.sendNotification).not.toHaveBeenCalled();
    });

    it('should mark device channel as sent when at least one device push succeeds', async () => {
        prismaService.client.notification.create.mockResolvedValueOnce({ id: 1 });
        prismaService.client.notificationChannel.create.mockResolvedValueOnce({
            id: 10,
        });
        deviceService.findDevicesByUser.mockResolvedValueOnce(['token-1', 'token-2']);
        firebaseService.sendNotification
            .mockResolvedValueOnce('firebase-ok')
            .mockRejectedValueOnce(new Error('firebase failed'));

        await service.handleNotificationSendEvent({
            recipientUserId: 99,
            title: 'Hello',
            body: 'World',
            type: NotificationType.ORDER,
            channels: [DeliveryChannel.DEVICE],
            targetType: 'ORDER',
            targetId: 7,
            actorId: 3,
            metadata: { orderId: 7 },
        });

        expect(firebaseService.sendNotification).toHaveBeenCalledWith('token-1', {
            notification: { title: 'Hello', body: 'World' },
            data: {
                notificationId: '1',
                type: NotificationType.ORDER,
                targetType: 'ORDER',
                targetId: '7',
                actorId: '3',
                metadata: JSON.stringify({ orderId: 7 }),
            },
        });
        expect(prismaService.client.notificationChannel.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: {
                status: DeliveryStatus.SENT,
                sentAt: expect.any(Date),
                providerResult: [
                    {
                        deviceToken: 'token-1',
                        success: true,
                        result: 'firebase-ok',
                    },
                    {
                        deviceToken: 'token-2',
                        success: false,
                        error: 'firebase failed',
                    },
                ],
            },
        });
    });

    it('should mark device channel as failed when all device pushes fail', async () => {
        prismaService.client.notification.create.mockResolvedValueOnce({ id: 1 });
        prismaService.client.notificationChannel.create.mockResolvedValueOnce({
            id: 10,
        });
        deviceService.findDevicesByUser.mockResolvedValueOnce(['token-1']);
        firebaseService.sendNotification.mockRejectedValueOnce(
            new Error('firebase failed'),
        );

        await service.handleNotificationSendEvent({
            recipientUserId: 99,
            title: 'Hello',
            body: 'World',
            type: NotificationType.SYSTEM,
            channels: [DeliveryChannel.DEVICE],
        });

        expect(prismaService.client.notificationChannel.update).toHaveBeenCalledWith({
            where: { id: 10 },
            data: {
                status: DeliveryStatus.FAILED,
                failedAt: expect.any(Date),
                error: 'firebase failed',
                providerResult: [
                    {
                        deviceToken: 'token-1',
                        success: false,
                        error: 'firebase failed',
                    },
                ],
            },
        });
    });

    it('should query my notifications with filters and pagination', async () => {
        const notifications = [{ id: 1 }];
        prismaService.client.notification.findMany.mockResolvedValueOnce(notifications);

        const result = await service.getMyNotifications(99, {
            type: NotificationType.ORDER,
            read: 'false',
            limit: 5,
            offset: 10,
        });

        expect(prismaService.client.notification.findMany).toHaveBeenCalledWith({
            where: {
                userId: 99,
                deleteAt: null,
                type: NotificationType.ORDER,
                readAt: null,
            },
            include: {
                channels: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 5,
            skip: 10,
        });
        expect(result).toEqual(notifications);
    });

    it('should query read notifications when read filter is true', async () => {
        prismaService.client.notification.findMany.mockResolvedValueOnce([]);

        await service.getMyNotifications(99, { read: 'true' });

        expect(prismaService.client.notification.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    userId: 99,
                    deleteAt: null,
                    readAt: { not: null },
                },
                take: 20,
                skip: 0,
            }),
        );
    });

    it('should return unread notification count', async () => {
        prismaService.client.notification.count.mockResolvedValueOnce(3);

        const result = await service.getUnreadCount(99);

        expect(prismaService.client.notification.count).toHaveBeenCalledWith({
            where: {
                userId: 99,
                readAt: null,
                deleteAt: null,
            },
        });
        expect(result).toEqual({ count: 3 });
    });

    it('should throw NotFoundException when marking missing notification as read', async () => {
        prismaService.client.notification.findFirst.mockResolvedValueOnce(null);

        await expect(service.markAsRead(99, 404)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should mark a notification as read', async () => {
        const updatedNotification = { id: 1, readAt: new Date() };
        prismaService.client.notification.findFirst.mockResolvedValueOnce({ id: 1 });
        prismaService.client.notification.update.mockResolvedValueOnce(
            updatedNotification,
        );

        const result = await service.markAsRead(99, 1);

        expect(prismaService.client.notification.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { readAt: expect.any(Date) },
        });
        expect(result).toEqual(updatedNotification);
    });

    it('should mark all notifications as read', async () => {
        prismaService.client.notification.updateMany.mockResolvedValueOnce({
            count: 2,
        });

        const result = await service.markAllAsRead(99);

        expect(prismaService.client.notification.updateMany).toHaveBeenCalledWith({
            where: {
                userId: 99,
                readAt: null,
            },
            data: {
                readAt: expect.any(Date),
            },
        });
        expect(result).toEqual({ message: 'All notifications marked as read' });
    });

    it('should emit test push notification event', async () => {
        const result = await service.testPushNotification(99);

        expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', {
            recipientUserId: 99,
            title: 'Test push notification',
            body: 'This is a test push notification',
            type: NotificationType.SYSTEM,
            channels: [DeliveryChannel.DEVICE],
        });
        expect(result).toEqual({
            [ResponseBody.MESSAGE]: 'Test notification event has been emitted',
        });
    });

    it('should delete notification by id and user id', async () => {
        prismaService.notification.delete.mockResolvedValueOnce({ id: 1 });

        await service.deleteNotificationById(1, 99);

        expect(prismaService.notification.delete).toHaveBeenCalledWith({
            where: {
                id: 1,
                userId: 99,
            },
        });
    });
});
