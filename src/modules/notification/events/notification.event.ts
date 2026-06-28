import { NotificationType, DeliveryChannel } from '@prisma/client';

export class NotificationEvent {
    recipientUserId: number;
    title: string;
    body: string;
    type: NotificationType;
    channels?: DeliveryChannel[]; // Defaults to [IN_APP, DEVICE]
    targetType?: string;
    targetId?: number;
    actorId?: number;
    metadata?: Record<string, any>;
}
