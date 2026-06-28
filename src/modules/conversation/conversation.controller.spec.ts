jest.mock('@prisma/client', () => ({
    Role: {
        CUSTOMER: 'CUSTOMER',
        SELLER: 'SELLER',
        ADMIN: 'ADMIN',
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

import { BadRequestException } from '@nestjs/common';
import { ConversationController } from './conversation.controller';

describe('ConversationController', () => {
    let controller: ConversationController;
    let conversationService: {
        getAllUserConversation: jest.Mock;
        createConversation: jest.Mock;
        getConversationByOrderId: jest.Mock;
        getConversationById: jest.Mock;
        markAsRead: jest.Mock;
    };
    let minioService: { uploadFile: jest.Mock };

    beforeEach(() => {
        conversationService = {
            getAllUserConversation: jest.fn(),
            createConversation: jest.fn(),
            getConversationByOrderId: jest.fn(),
            getConversationById: jest.fn(),
            markAsRead: jest.fn(),
        };
        minioService = {
            uploadFile: jest.fn(),
        };

        controller = new ConversationController(
            conversationService as any,
            minioService as any,
        );
    });

    it('should forward my conversations request with authenticated user id', async () => {
        conversationService.getAllUserConversation.mockResolvedValue([
            { id: 1 },
        ]);

        const result = await controller.getMyConversations({
            user: { id: 99 },
        } as any);

        expect(result).toEqual([{ id: 1 }]);
        expect(conversationService.getAllUserConversation).toHaveBeenCalledWith(
            99,
        );
    });

    it('should forward admin user conversations request with route user id', async () => {
        conversationService.getAllUserConversation.mockResolvedValue([
            { id: 1 },
        ]);

        const result = await controller.getAllUsersConversations(2);

        expect(result).toEqual([{ id: 1 }]);
        expect(conversationService.getAllUserConversation).toHaveBeenCalledWith(
            2,
        );
    });

    it('should forward create conversation request with authenticated user id and body', async () => {
        const body = { sellerId: 3 };
        conversationService.createConversation.mockResolvedValue({ id: 1 });

        const result = await controller.createConversation(
            { user: { id: 2 } } as any,
            body,
        );

        expect(result).toEqual({ id: 1 });
        expect(conversationService.createConversation).toHaveBeenCalledWith(
            2,
            body,
        );
    });

    it('should forward order detail request with default pagination', async () => {
        conversationService.getConversationByOrderId.mockResolvedValue({
            conversation: { id: 1 },
            messages: [],
        });

        const result = await controller.getConversationDetailById(10, {}, {
            user: { id: 2 },
        } as any);

        expect(result).toEqual({
            conversation: { id: 1 },
            messages: [],
        });
        expect(
            conversationService.getConversationByOrderId,
        ).toHaveBeenCalledWith(2, 10, 20, 0);
    });

    it('should forward conversation detail request with provided pagination', async () => {
        conversationService.getConversationById.mockResolvedValue({
            conversation: { id: 1 },
            messages: [],
        });

        const result = await controller.getConversationById(
            1,
            { limit: 5, offset: 10 },
            { user: { id: 2 } } as any,
        );

        expect(result).toEqual({
            conversation: { id: 1 },
            messages: [],
        });
        expect(conversationService.getConversationById).toHaveBeenCalledWith(
            2,
            1,
            5,
            10,
        );
    });

    it('should upload chat image through MinioService', async () => {
        const file = { originalname: 'chat.jpg' } as any;
        minioService.uploadFile.mockResolvedValue(
            'https://cdn.example.com/chat.jpg',
        );

        const result = await controller.uploadChatImage(file);

        expect(minioService.uploadFile).toHaveBeenCalledWith(file);
        expect(result).toEqual({
            imageUrl: 'https://cdn.example.com/chat.jpg',
        });
    });

    it('should reject chat image upload without a file', async () => {
        await expect(
            controller.uploadChatImage(undefined as any),
        ).rejects.toThrow(BadRequestException);
    });

    it('should mark conversation messages as read and return success response', async () => {
        conversationService.markAsRead.mockResolvedValue(undefined);

        const result = await controller.markAsRead(1, {
            user: { id: 2 },
        } as any);

        expect(conversationService.markAsRead).toHaveBeenCalledWith(2, 1);
        expect(result).toEqual({
            success: true,
            message: 'Marked all messages as read',
        });
    });
});
