import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { CreateConversationDto } from './dto/conversation.dto';

@Injectable()
export class ConversationService {
    constructor(private readonly prismaService: PrismaService) {}

    private async findConversationForUserOrThrow(
        userId: number,
        conversationId: number,
    ) {
        const conversation =
            await this.prismaService.client.conversation.findFirst({
                where: {
                    id: conversationId,
                    OR: [{ sellerId: userId }, { customerId: userId }],
                },
            });

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        return conversation;
    }

    async createConversation(userId: number, data: CreateConversationDto) {
        if (userId === data.sellerId) {
            throw new BadRequestException(
                'Customer and seller must be different users',
            );
        }

        const sellerRestaurant =
            await this.prismaService.client.restaurant.findFirst({
                where: {
                    ownerId: data.sellerId,
                    deleteAt: null,
                },
                select: {
                    id: true,
                },
            });

        if (!sellerRestaurant) {
            throw new NotFoundException('Seller restaurant not found');
        }

        const existsConversation =
            await this.prismaService.client.conversation.findFirst({
                where: {
                    customerId: userId,
                    sellerId: data.sellerId,
                },
                select: {
                    id: true,
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
            });

        if (existsConversation) {
            return existsConversation;
        }

        return await this.prismaService.client.conversation.create({
            data: {
                customerId: userId,
                sellerId: data.sellerId,
            },
            select: {
                id: true,
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
        });
    }

    async ensureConversationForOrder(
        _orderId: number,
        customerId: number,
        sellerId: number,
    ) {
        const existsConversation =
            await this.prismaService.client.conversation.findFirst({
                where: {
                    customerId,
                    sellerId,
                },
            });

        if (existsConversation) {
            return existsConversation;
        }

        const conversation =
            await this.prismaService.client.conversation.create({
                data: {
                    customerId,
                    sellerId,
                },
                select: {
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
            });
        return conversation;
    }

    async getAllUserConversation(userId: number) {
        const conversations =
            await this.prismaService.client.conversation.findMany({
                where: {
                    OR: [{ sellerId: userId }, { customerId: userId }],
                },
                select: {
                    id: true,
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
            });

        if (conversations.length === 0) {
            return [];
        }

        const sellerIds = [
            ...new Set(
                conversations.map((conversation) => conversation.sellerId),
            ),
        ];
        const restaurants = await this.prismaService.client.restaurant.findMany(
            {
                where: {
                    ownerId: {
                        in: sellerIds,
                    },
                },
                select: {
                    id: true,
                    ownerId: true,
                    name: true,
                    image: true,
                },
            },
        );
        const restaurantMap = new Map(
            restaurants.map((restaurant) => [
                restaurant.ownerId,
                {
                    id: restaurant.id,
                    name: restaurant.name,
                    image: restaurant.image,
                },
            ]),
        );

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
            const restaurant = restaurantMap.get(conversation.sellerId) ?? null;
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
        const order = await this.prismaService.client.order.findUnique({
            where: {
                id: orderId,
            },
            select: {
                userId: true,
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        ownerId: true,
                    },
                },
            },
        });

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        if (order.userId !== userId && order.restaurant.ownerId !== userId) {
            throw new ForbiddenException(
                'Only participants of the order conversation can view it',
            );
        }

        const conversation =
            await this.prismaService.client.conversation.findFirst({
                where: {
                    customerId: order.userId,
                    sellerId: order.restaurant.ownerId,
                },
                select: {
                    id: true,
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
            });

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

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
                restaurant: {
                    id: order.restaurant.id,
                    name: order.restaurant.name,
                    image: order.restaurant.image,
                },
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
        const conversation =
            await this.prismaService.client.conversation.findFirst({
                where: {
                    id: conversationId,
                    OR: [{ sellerId: userId }, { customerId: userId }],
                },
                select: {
                    id: true,
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
            });

        if (!conversation) {
            throw new NotFoundException('Conversation not found');
        }

        const restaurant = await this.prismaService.client.restaurant.findFirst(
            {
                where: {
                    ownerId: conversation.sellerId,
                },
                select: {
                    id: true,
                    name: true,
                    image: true,
                },
            },
        );

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
                restaurant,
            },
            messages: messages.map((message) => ({
                ...message,
                who: userId === message.senderId ? 'me' : 'other',
            })),
        };
    }

    async markAsRead(userId: number, conversationId: number) {
        const conversation =
            await this.prismaService.client.conversation.findFirst({
                where: {
                    id: conversationId,
                    OR: [{ sellerId: userId }, { customerId: userId }],
                },
            });

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
