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

import { NotificationType } from '@prisma/client';
import { NotificationController } from './notification.controller';

describe('NotificationController', () => {
    let controller: NotificationController;
    let notificationService: {
        pushNotification: jest.Mock;
        getMyNotifications: jest.Mock;
        getUnreadCount: jest.Mock;
        markAsRead: jest.Mock;
        markAllAsRead: jest.Mock;
        testPushNotification: jest.Mock;
        deleteNotificationById: jest.Mock;
    };

    beforeEach(() => {
        notificationService = {
            pushNotification: jest.fn(),
            getMyNotifications: jest.fn(),
            getUnreadCount: jest.fn(),
            markAsRead: jest.fn(),
            markAllAsRead: jest.fn(),
            testPushNotification: jest.fn(),
            deleteNotificationById: jest.fn(),
        };

        controller = new NotificationController(notificationService as any);
    });

    it('should push notification for authenticated user', async () => {
        const body = {
            title: 'Order update',
            body: 'Your order is ready',
            type: NotificationType.ORDER,
        };
        notificationService.pushNotification.mockResolvedValueOnce({
            message: 'ok',
        });

        const result = await controller.sendNotification(body, {
            user: { id: 99 },
        } as any);

        expect(notificationService.pushNotification).toHaveBeenCalledWith(
            99,
            'Order update',
            'Your order is ready',
            NotificationType.ORDER,
        );
        expect(result).toEqual({ message: 'ok' });
    });

    it('should get notifications for authenticated user with query', async () => {
        const query = { read: 'false', limit: 5, offset: 0 };
        notificationService.getMyNotifications.mockResolvedValueOnce([{ id: 1 }]);

        const result = await controller.getMyNotifications(
            { user: { id: 99 } } as any,
            query,
        );

        expect(notificationService.getMyNotifications).toHaveBeenCalledWith(
            99,
            query,
        );
        expect(result).toEqual([{ id: 1 }]);
    });

    it('should get unread count for authenticated user', async () => {
        notificationService.getUnreadCount.mockResolvedValueOnce({ count: 3 });

        const result = await controller.getUnreadCount({
            user: { id: 99 },
        } as any);

        expect(notificationService.getUnreadCount).toHaveBeenCalledWith(99);
        expect(result).toEqual({ count: 3 });
    });

    it('should mark notification as read', async () => {
        notificationService.markAsRead.mockResolvedValueOnce({ id: 1 });

        const result = await controller.markAsRead(
            { user: { id: 99 } } as any,
            1,
        );

        expect(notificationService.markAsRead).toHaveBeenCalledWith(99, 1);
        expect(result).toEqual({ id: 1 });
    });

    it('should mark all notifications as read', async () => {
        notificationService.markAllAsRead.mockResolvedValueOnce({
            message: 'All notifications marked as read',
        });

        const result = await controller.markAllAsRead({
            user: { id: 99 },
        } as any);

        expect(notificationService.markAllAsRead).toHaveBeenCalledWith(99);
        expect(result).toEqual({ message: 'All notifications marked as read' });
    });

    it('should send a test notification', async () => {
        notificationService.testPushNotification.mockResolvedValueOnce({
            message: 'emitted',
        });

        const result = await controller.testSendNotification({
            user: { id: 99 },
        } as any);

        expect(notificationService.testPushNotification).toHaveBeenCalledWith(99);
        expect(result).toEqual({ message: 'emitted' });
    });

    it('should delete notification and return success message', async () => {
        notificationService.deleteNotificationById.mockResolvedValueOnce(undefined);

        const result = await controller.deleteNotificationByid(
            1,
            { user: { id: 99 } } as any,
        );

        expect(notificationService.deleteNotificationById).toHaveBeenCalledWith(
            1,
            99,
        );
        expect(result).toEqual({
            message: 'Notification delete successfullt',
        });
    });
});
