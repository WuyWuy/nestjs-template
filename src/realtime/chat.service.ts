import { Injectable } from '@nestjs/common';
import { ChatMessage } from './dto/chat.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class ChatService {
    constructor(private readonly prismaService: PrismaService) {}
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
            const content = message.content.trim();
            if (!content) {
                throw new WsException('Message content is required');
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
                    content,
                },
                select: {
                    id: true,
                    conversationId: true,
                    senderId: true,
                    content: true,
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
            return result;
        } catch (err) {
            console.log("Store Db And Emit message error" , err) 
            throw err;
        }
    }
}
