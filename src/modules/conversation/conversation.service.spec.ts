jest.mock('@prisma/client', () => ({
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
    Role: {
        CUSTOMER: 'CUSTOMER',
        SELLER: 'SELLER',
        ADMIN: 'ADMIN',
    },
}));

import { ConversationService } from './conversation.service';

describe('ConversationService', () => {
    let service: ConversationService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                conversation: {
                    findMany: jest.fn(),
                    findFirst: jest.fn(),
                    create: jest.fn(),
                },
                order: {
                    findMany: jest.fn(),
                    findFirst: jest.fn(),
                },
                message: {
                    groupBy: jest.fn(),
                    findMany: jest.fn(),
                },
            },
        };

        service = new ConversationService(prismaService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getAllUserConversation', () => {
        it('should return empty list when user has no conversations', async () => {
            prismaService.client.conversation.findMany.mockResolvedValueOnce([]);
            prismaService.client.order.findMany.mockResolvedValueOnce([]);
            prismaService.client.message.groupBy.mockResolvedValueOnce([]);

            const result = await service.getAllUserConversation(1);
            expect(result).toEqual([]);
        });

        it('should return conversations with unreadCount, customer, seller, and restaurant details at top level', async () => {
            const mockDate = new Date();
            const mockConversations = [
                {
                    id: 1,
                    orderId: 10,
                    customerId: 2,
                    sellerId: 3,
                    createdAt: mockDate,
                    updatedAt: mockDate,
                    messages: [
                        {
                            id: 100,
                            content: 'Hello, food is coming',
                            senderId: 3,
                            createdAt: mockDate,
                            image: '',
                            isRead: false,
                        },
                    ],
                    customer: {
                        id: 2,
                        name: 'Customer A',
                        avatar: 'customer.jpg',
                    },
                    seller: {
                        id: 3,
                        name: 'Seller B',
                        avatar: 'seller.jpg',
                    },
                },
            ];

            const mockOrders = [
                {
                    id: 10,
                    status: 'DELIVERED',
                    restaurant: {
                        id: 101,
                        name: 'Pizza Shop',
                        image: 'pizza.jpg',
                    },
                },
            ];

            const mockUnreadCounts = [
                {
                    conversationId: 1,
                    _count: {
                        id: 1,
                    },
                },
            ];

            prismaService.client.conversation.findMany.mockResolvedValueOnce(mockConversations);
            prismaService.client.order.findMany.mockResolvedValueOnce(mockOrders);
            prismaService.client.message.groupBy.mockResolvedValueOnce(mockUnreadCounts);

            const result = await service.getAllUserConversation(2); // customer is user 2

            expect(prismaService.client.conversation.findMany).toHaveBeenCalledWith({
                where: {
                    OR: [{ sellerId: 2 }, { customerId: 2 }],
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
            });

            expect(prismaService.client.message.groupBy).toHaveBeenCalledWith({
                by: ['conversationId'],
                where: {
                    conversationId: { in: [1] },
                    senderId: { not: 2 },
                    isRead: false,
                },
                _count: {
                    id: true,
                },
            });

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                id: 1,
                orderId: 10,
                customerId: 2,
                sellerId: 3,
                createdAt: mockDate,
                updatedAt: mockDate,
                customer: {
                    id: 2,
                    name: 'Customer A',
                    avatar: 'customer.jpg',
                },
                seller: {
                    id: 3,
                    name: 'Seller B',
                    avatar: 'seller.jpg',
                },
                restaurant: {
                    id: 101,
                    name: 'Pizza Shop',
                    image: 'pizza.jpg',
                },
                lastMessage: {
                    id: 100,
                    content: 'Hello, food is coming',
                    senderId: 3,
                    createdAt: mockDate,
                    image: '',
                    isRead: false,
                },
                unreadCount: 1,
            });
        });
    });

    describe('getConversationByOrderId', () => {
        it('should throw NotFoundException if conversation not found', async () => {
            prismaService.client.conversation.findFirst.mockResolvedValueOnce(null);

            await expect(
                service.getConversationByOrderId(1, 10),
            ).rejects.toThrow('Conversation not found');
        });

        it('should return conversation details and messages with who field', async () => {
            const mockDate = new Date();
            const mockConversation = {
                id: 1,
                orderId: 10,
                customerId: 2,
                sellerId: 3,
                createdAt: mockDate,
                updatedAt: mockDate,
                customer: { id: 2, name: 'Customer A', avatar: 'customer.jpg' },
                seller: { id: 3, name: 'Seller B', avatar: 'seller.jpg' },
            };

            const mockOrder = {
                id: 10,
                restaurant: { id: 101, name: 'Pizza Shop', image: 'pizza.jpg' },
            };

            const mockMessages = [
                { id: 100, conversationId: 1, senderId: 2, content: 'Hello', image: '', isRead: true, createdAt: mockDate },
                { id: 101, conversationId: 1, senderId: 3, content: 'Hi', image: '', isRead: false, createdAt: mockDate },
            ];

            prismaService.client.conversation.findFirst.mockResolvedValueOnce(mockConversation);
            prismaService.client.order.findUnique = jest.fn().mockResolvedValueOnce(mockOrder);
            prismaService.client.message.findMany.mockResolvedValueOnce(mockMessages);

            const result = await service.getConversationByOrderId(2, 10, 20, 0);

            expect(result).toEqual({
                conversation: {
                    ...mockConversation,
                    restaurant: { id: 101, name: 'Pizza Shop', image: 'pizza.jpg' },
                },
                messages: [
                    { ...mockMessages[0], who: 'me' },
                    { ...mockMessages[1], who: 'other' },
                ],
            });
        });
    });

    describe('getConversationById', () => {
        it('should throw NotFoundException if conversation not found', async () => {
            prismaService.client.conversation.findFirst.mockResolvedValueOnce(null);

            await expect(
                service.getConversationById(1, 1),
            ).rejects.toThrow('Conversation not found');
        });

        it('should return conversation details and messages with who field by conversationId', async () => {
            const mockDate = new Date();
            const mockConversation = {
                id: 1,
                orderId: 10,
                customerId: 2,
                sellerId: 3,
                createdAt: mockDate,
                updatedAt: mockDate,
                customer: { id: 2, name: 'Customer A', avatar: 'customer.jpg' },
                seller: { id: 3, name: 'Seller B', avatar: 'seller.jpg' },
            };

            const mockOrder = {
                id: 10,
                restaurant: { id: 101, name: 'Pizza Shop', image: 'pizza.jpg' },
            };

            const mockMessages = [
                { id: 100, conversationId: 1, senderId: 2, content: 'Hello', image: '', isRead: true, createdAt: mockDate },
                { id: 101, conversationId: 1, senderId: 3, content: 'Hi', image: '', isRead: false, createdAt: mockDate },
            ];

            prismaService.client.conversation.findFirst.mockResolvedValueOnce(mockConversation);
            prismaService.client.order.findUnique = jest.fn().mockResolvedValueOnce(mockOrder);
            prismaService.client.message.findMany.mockResolvedValueOnce(mockMessages);

            const result = await service.getConversationById(2, 1, 20, 0);

            expect(result).toEqual({
                conversation: {
                    ...mockConversation,
                    restaurant: { id: 101, name: 'Pizza Shop', image: 'pizza.jpg' },
                },
                messages: [
                    { ...mockMessages[0], who: 'me' },
                    { ...mockMessages[1], who: 'other' },
                ],
            });
        });
    });

    describe('markAsRead', () => {
        it('should throw NotFoundException if conversation not found or user is not part of it', async () => {
            prismaService.client.conversation.findFirst.mockResolvedValueOnce(null);

            await expect(
                service.markAsRead(1, 10),
            ).rejects.toThrow('Conversation not found');
        });

        it('should mark other sender\'s unread messages in the conversation as read', async () => {
            const mockConversation = {
                id: 10,
                customerId: 2,
                sellerId: 3,
            };

            prismaService.client.conversation.findFirst.mockResolvedValueOnce(mockConversation);
            prismaService.client.message.updateMany = jest.fn().mockResolvedValueOnce({ count: 2 });

            await service.markAsRead(2, 10); // current user is customer 2

            expect(prismaService.client.conversation.findFirst).toHaveBeenCalledWith({
                where: {
                    id: 10,
                    OR: [{ sellerId: 2 }, { customerId: 2 }],
                },
            });

            expect(prismaService.client.message.updateMany).toHaveBeenCalledWith({
                where: {
                    conversationId: 10,
                    senderId: { not: 2 },
                    isRead: false,
                },
                data: {
                    isRead: true,
                },
            });
        });
    });
});
