import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CreateConversationDto } from './dto/conversation.dto';

@Injectable()
export class ConversationService {
    constructor(private readonly prismaService: PrismaService) {}

    private async findConversationForUserOrThrow(
        userId: number,
        conversationId: number,
    ) {
        const conversation = await this.prismaService.client.conversation.findFirst(
            {
                where: {
                    id: conversationId,
                    OR: [{ sellerId: userId }, { customerId: userId }],
                },
            },
        );

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        return conversation;
    }

    async createConversation(userId: number, data: CreateConversationDto) {
        const order = await this.prismaService.client.order.findFirst({
            where: {
                id: data.orderId,
            },
            select: {
                id: true,
                userId: true,
                restaurant: {
                    select: {
                        ownerId: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId) {
            throw new ForbiddenException(
                'Only the customer of the order can open a conversation',
            );
        }

        if (order.restaurant.ownerId !== data.sellerId) {
            throw new BadRequestException(
                'Seller does not match the restaurant owner',
            );
        }

        const existsConversation =
            await this.prismaService.client.conversation.findFirst({
                where: {
                    orderId: data.orderId,
                },
            });

        if (existsConversation) {
            return existsConversation;
        }

        return await this.prismaService.client.conversation.create({
            data: {
                orderId: data.orderId,
                customerId: userId,
                sellerId: data.sellerId,
            },
        });
    }

    async ensureConversationForOrder(
        orderId: number,
        customerId: number,
        sellerId: number,
    ) {
        const existsConversation =
            await this.prismaService.client.conversation.findFirst({
                where: {
                    orderId,
                },
            });

        if (existsConversation) {
            return existsConversation;
        }

        return await this.prismaService.client.conversation.create({
            data: {
                orderId,
                customerId,
                sellerId,
            },
        });
    }

    async getAllUserConversation(userId: number) {
        console.log(userId) 
        const conversations = await this.prismaService.client.conversation.findMany(
            {
                where: {
                    OR: [{ sellerId: userId }, { customerId: userId }],
                },
                select: {
                    id: true,
                    orderId: true,
                    customerId: true,
                    sellerId: true,
                    updatedAt: true,
                    createdAt: true,
                    messages: {
                        take: 1,
                        orderBy: {
                            createdAt: 'desc',
                        },
                        select: {
                            id: true,
                            content: true,
                            senderId: true,
                            createdAt: true,
                            image: true,
                            isRead: true,
                        },
                    },
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                    seller: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                },
                orderBy: {
                    updatedAt: 'desc',
                },
            },
        );

        const orderIds = conversations.map((conversation) => conversation.orderId);
        const orders = await this.prismaService.client.order.findMany({
            where: {
                id: {
                    in: orderIds,
                },
            },
            select: {
                id: true,
                status: true,
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });
        const orderMap = new Map(orders.map((order) => [order.id, order]));

        const unreadCounts = await this.prismaService.client.message.groupBy({
            by: ['conversationId'],
            where: {
                conversationId: {
                    in: conversations.map((c) => c.id),
                },
                senderId: {
                    not: userId,
                },
                isRead: false,
            },
            _count: {
                id: true,
            },
        });
        const unreadCountMap = new Map(
            unreadCounts.map((item) => [item.conversationId, item._count.id]),
        );

        return conversations.map((conversation) => {
            const { messages, ...rest } = conversation;
            const order = orderMap.get(conversation.orderId) ?? null;
            const restaurant = order?.restaurant ?? null;
            return {
                ...rest,
                restaurant,
                lastMessage: messages[0] ?? null,
                unreadCount: unreadCountMap.get(conversation.id) ?? 0,
            };
        });
    }

    async getConversationByOrderId(
        userId: number,
        orderId: number,
        limit: number = 20,
        offset: number = 0,
    ) {
        const conversation = await this.prismaService.client.conversation.findFirst(
            {
                where: {
                    orderId,
                    OR: [{ sellerId: userId }, { customerId: userId }],
                },
                select: {
                    id: true,
                    orderId: true,
                    customerId: true,
                    sellerId: true,
                    createdAt: true,
                    updatedAt: true,
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                    seller: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                },
            },
        );

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        const order = await this.prismaService.client.order.findUnique({
            where: {
                id: orderId,
            },
            select: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });

        const messages = await this.prismaService.client.message.findMany({
            where: {
                conversationId: conversation.id,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: limit,
            skip: offset,
            select: {
                id: true,
                conversationId: true,
                senderId: true,
                content: true,
                image: true,
                createdAt: true,
                isRead: true,
            },
        });

        return {
            conversation: {
                ...conversation,
                restaurant: order?.restaurant ?? null,
            },
            messages: messages.map((message) => ({
                ...message,
                who: userId === message.senderId ? 'me' : 'other',
            })),
        };
    }

    async getConversationById(
        userId: number,
        conversationId: number,
        limit: number = 20,
        offset: number = 0,
    ) {
        const conversation = await this.prismaService.client.conversation.findFirst(
            {
                where: {
                    id: conversationId,
                    OR: [{ sellerId: userId }, { customerId: userId }],
                },
                select: {
                    id: true,
                    orderId: true,
                    customerId: true,
                    sellerId: true,
                    createdAt: true,
                    updatedAt: true,
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                    seller: {
                        select: {
                            id: true,
                            name: true,
                            avatar: true,
                        },
                    },
                },
            },
        );

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        const order = await this.prismaService.client.order.findUnique({
            where: {
                id: conversation.orderId,
            },
            select: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                    },
                },
            },
        });

        const messages = await this.prismaService.client.message.findMany({
            where: {
                conversationId: conversation.id,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: limit,
            skip: offset,
            select: {
                id: true,
                conversationId: true,
                senderId: true,
                content: true,
                image: true,
                createdAt: true,
                isRead: true,
            },
        });

        return {
            conversation: {
                ...conversation,
                restaurant: order?.restaurant ?? null,
            },
            messages: messages.map((message) => ({
                ...message,
                who: userId === message.senderId ? 'me' : 'other',
            })),
        };
    }

    async markAsRead(userId: number, conversationId: number) {
        const conversation = await this.prismaService.client.conversation.findFirst(
            {
                where: {
                    id: conversationId,
                    OR: [{ sellerId: userId }, { customerId: userId }],
                },
            },
        );

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        await this.prismaService.client.message.updateMany({
            where: {
                conversationId: conversation.id,
                senderId: {
                    not: userId,
                },
                isRead: false,
            },
            data: {
                isRead: true,
            },
        });
    }
}
