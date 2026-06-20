import { Injectable } from '@nestjs/common';
import { ChatMessage } from './dto/chat.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { WsException } from '@nestjs/websockets';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { NotificationEvent } from '../modules/notification/events/notification.event';

@Injectable()
export class ChatService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async validateConversation(userId: number, conversationId: number) {
        const conversation = await this.prismaService.client.conversation.findFirst(
            {
                where: { id: conversationId },
            },
        );
        if (!conversation) throw new WsException('Conversation not found');
        if (
            conversation.customerId !== userId &&
            conversation.sellerId !== userId
        )
            throw new WsException('Forbidden');
        return conversation;
    }

    async storeDbAndEmitMessage(senderId: number, message: ChatMessage) {
        try {
            const { conversationId } = message;
            const content = message.content?.trim();
            const image = message.image?.trim();
            if (!content && !image) {
                throw new WsException('Message content or image is required');
            }

            const conversation = await this.prismaService.client.conversation.findFirst(
                {
                    where: { id: conversationId },
                },
            );
            if (!conversation)
                throw new WsException('Conversation is not initialized');
            if (
                conversation.customerId !== senderId &&
                conversation.sellerId !== senderId
            )
                throw new WsException(
                    'You are not belong to this conversation',
                );

            //Store data to the database
            const result = await this.prismaService.client.message.create({
                data: {
                    senderId,
                    conversationId,
                    content: content ?? '',
                    image: image ?? '',
                },
                select: {
                    id: true,
                    conversationId: true,
                    senderId: true,
                    content: true,
                    image: true,
                    createdAt: true,
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                },
            });

            // Send notification to the opposite participant in the conversation
            try {
                const recipientUserId =
                    conversation.customerId === senderId
                        ? conversation.sellerId
                        : conversation.customerId;

                const senderName = result.sender?.name || 'Someone';
                const bodyText = result.content ? result.content : 'Sent an image';

                this.eventEmitter.emit('notification.send', {
                    recipientUserId,
                    title: senderName,
                    body: bodyText,
                    type: NotificationType.CHAT,
                    targetType: 'CONVERSATION',
                    targetId: conversationId,
                    actorId: senderId,
                    metadata: {
                        conversationId,
                        messageId: result.id,
                    },
                } as NotificationEvent);
            } catch (err) {
                console.error('Error emitting chat notification:', err);
            }

            return result;
        } catch (err) {
            console.log("Store Db And Emit message error" , err) 
            throw err;
        }
    }
}
