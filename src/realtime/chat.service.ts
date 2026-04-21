import { Injectable } from '@nestjs/common';
import { ChatMessage } from './dto/chat.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class ChatService {
    constructor(private readonly prismaService: PrismaService) {}
    async validateConversation(userId: number, conversationId: number) {

        const conversation = await this.prismaService.conversation.findFirst({
            where: { id: conversationId },
        });
        console.log(conversation)
        if (!conversation) 
            throw new WsException("Conversation not found") 
        if (conversation.customerId !== userId && conversation.sellerId !== userId) 
            throw new WsException("Forbidden") 
        return conversation
    }
    async storeDbAndEmitMessage(senderId: number, message: ChatMessage) {
        try {
            const { conversationId, content } = message;
            const conversation =
                await this.prismaService.conversation.findUnique({
                    where: { id: conversationId },
                });
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
            const result = await this.prismaService.message.create({
                data: {
                    senderId,
                    conversationId,
                    content,
                },
            });
            return result;
        } catch (err) {
            console.log('conversation error: ', err);
            throw err;
        }
    }
}
