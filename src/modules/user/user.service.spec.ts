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
}));

import {
    BadRequestException,
    UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';

describe('UserService - getMyReviews', () => {
    let service: UserService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurantRating: {
                    findMany: jest.fn(),
                },
            },
        };

        service = new UserService(
            prismaService,
            {} as any,
            {} as any,
        );
    });

    it('should query and return user reviews in correct format', async () => {
        const mockRatings = [
            {
                id: 12,
                restaurantId: 101,
                vote: 5,
                comment: 'Đồ ăn rất ngon, giao hàng siêu nhanh!',
                tags: ['Món ăn ngon', 'Giao hàng nhanh'],
                orderId: 162432,
                createdAt: new Date('2026-06-22T13:49:30Z'),
                reply: 'Cảm ơn quý khách đã ủng hộ nhà hàng!',
                replyCreatedAt: new Date('2026-06-22T14:30:00Z'),
                restaurant: {
                    name: 'Bún Chả Hương Liên',
                },
            },
        ];

        prismaService.client.restaurantRating.findMany.mockResolvedValueOnce(mockRatings);

        const result = await service.getMyReviews(5, 20, 0);

        expect(prismaService.client.restaurantRating.findMany).toHaveBeenCalledWith({
            where: {
                userId: 5,
                deleteAt: null,
            },
            take: 20,
            skip: 0,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                restaurant: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        expect(result).toEqual([
            {
                id: 12,
                restaurantId: 101,
                restaurantName: 'Bún Chả Hương Liên',
                vote: 5,
                comment: 'Đồ ăn rất ngon, giao hàng siêu nhanh!',
                tags: ['Món ăn ngon', 'Giao hàng nhanh'],
                orderId: 162432,
                createdAt: expect.any(Date),
                reply: 'Cảm ơn quý khách đã ủng hộ nhà hàng!',
                replyCreatedAt: expect.any(Date),
            },
        ]);
    });
});

describe('UserService - profile and customers', () => {
    let service: UserService;
    let prismaService: any;
    let minioService: { uploadFile: jest.Mock; getFileUrl: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                user: {
                    findFirst: jest.fn(),
                    findMany: jest.fn(),
                },
            },
            transaction: jest.fn(async (callback) =>
                callback({
                    user: {
                        update: jest.fn(),
                    },
                }),
            ),
        };
        minioService = {
            uploadFile: jest.fn(),
            getFileUrl: jest.fn(),
        };

        service = new UserService(
            prismaService,
            minioService as any,
            {} as any,
        );
    });

    it('should find a user by id with cart included', async () => {
        prismaService.client.user.findFirst.mockResolvedValueOnce({
            id: 1,
            cart: { id: 10 },
        });

        const result = await service.findById(1);

        expect(prismaService.client.user.findFirst).toHaveBeenCalledWith({
            where: {
                id: 1,
            },
            include: {
                cart: true,
            },
        });
        expect(result).toEqual({ id: 1, cart: { id: 10 } });
    });

    it('should upload a profile image through MinioService', async () => {
        const file = { originalname: 'avatar.jpg' } as any;
        minioService.uploadFile.mockResolvedValueOnce('avatar-key');

        const result = await service.uploadImages(file);

        expect(minioService.uploadFile).toHaveBeenCalledWith(file);
        expect(result).toBe('avatar-key');
    });

    it('should reject image upload when file is missing', async () => {
        await expect(service.uploadImages(undefined as any)).rejects.toThrow(
            BadRequestException,
        );
        expect(minioService.uploadFile).not.toHaveBeenCalled();
    });

    it('should list users with customer role only', async () => {
        prismaService.client.user.findMany.mockResolvedValueOnce([
            { id: 1, name: 'Customer', email: 'c@test.dev', phone: '090' },
        ]);

        const result = await service.getAllUsers();

        expect(prismaService.client.user.findMany).toHaveBeenCalledWith({
            where: {
                userRoles: {
                    some: {
                        role: 'CUSTOMER',
                    },
                },
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
            },
        });
        expect(result).toEqual([
            { id: 1, name: 'Customer', email: 'c@test.dev', phone: '090' },
        ]);
    });

    it('should soft delete a customer account inside a transaction', async () => {
        const tx = {
            user: {
                update: jest.fn().mockResolvedValue({ id: 1, deleteAt: new Date() }),
            },
        };
        prismaService.transaction.mockImplementationOnce((callback: any) =>
            callback(tx),
        );

        const result = await service.deleteCustomerAccount(1);

        expect(tx.user.update).toHaveBeenCalledWith({
            where: {
                id: 1,
            },
            data: {
                deleteAt: expect.any(Date),
            },
        });
        expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    it('should return user profile with a resolved stored avatar url', async () => {
        prismaService.client.user.findFirst
            .mockResolvedValueOnce({ id: 1 })
            .mockResolvedValueOnce({
                name: 'Customer',
                email: 'c@test.dev',
                phone: '090',
                birthday: '2000-01-01',
                avatar: 'avatar-key',
            });
        minioService.getFileUrl.mockResolvedValueOnce(
            'https://cdn.example.com/avatar-key',
        );

        const result = await service.getUserProfile(1);

        expect(minioService.getFileUrl).toHaveBeenCalledWith('avatar-key');
        expect(result).toEqual({
            name: 'Customer',
            email: 'c@test.dev',
            phone: '090',
            birthday: '2000-01-01',
            avatar: 'https://cdn.example.com/avatar-key',
        });
    });

    it('should keep absolute avatar urls unchanged in user profile', async () => {
        prismaService.client.user.findFirst
            .mockResolvedValueOnce({ id: 1 })
            .mockResolvedValueOnce({
                name: 'Customer',
                email: 'c@test.dev',
                phone: '090',
                birthday: null,
                avatar: 'https://example.com/avatar.jpg',
            });

        const result = await service.getUserProfile(1);

        expect(minioService.getFileUrl).not.toHaveBeenCalled();
        expect(result.avatar).toBe('https://example.com/avatar.jpg');
    });

    it('should throw BadRequestException when profile user does not exist', async () => {
        prismaService.client.user.findFirst.mockResolvedValueOnce(null);

        await expect(service.getUserProfile(404)).rejects.toThrow(
            BadRequestException,
        );
    });

    it('should update profile and upload a new avatar when file is provided', async () => {
        const file = { originalname: 'new-avatar.jpg' } as any;
        const data = { name: 'Updated', phone: '091' };
        const tx = {
            user: {
                update: jest.fn().mockResolvedValue({
                    id: 1,
                    ...data,
                    avatar: 'new-avatar-key',
                }),
            },
        };
        prismaService.client.user.findFirst.mockResolvedValueOnce({
            id: 1,
            avatar: 'old-avatar-key',
        });
        prismaService.transaction.mockImplementationOnce((callback: any) =>
            callback(tx),
        );
        minioService.uploadFile.mockResolvedValueOnce('new-avatar-key');

        const result = await service.updateUserProfile(1, data, file);

        expect(minioService.uploadFile).toHaveBeenCalledWith(file);
        expect(tx.user.update).toHaveBeenCalledWith({
            where: { id: 1 },
            data: {
                ...data,
                avatar: 'new-avatar-key',
            },
        });
        expect(result).toEqual({
            id: 1,
            ...data,
            avatar: 'new-avatar-key',
        });
    });
});

describe('UserService - addresses', () => {
    let service: UserService;
    let prismaService: any;
    let addressService: { createAddress: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                user: {
                    findFirst: jest.fn(),
                },
                userAddress: {
                    findFirst: jest.fn(),
                    findMany: jest.fn(),
                    update: jest.fn(),
                },
            },
            transaction: jest.fn(async (callback) =>
                callback({
                    userAddress: {
                        create: jest.fn(),
                        update: jest.fn(),
                        findFirst: jest.fn(),
                    },
                }),
            ),
        };
        addressService = {
            createAddress: jest.fn(),
        };

        service = new UserService(
            prismaService,
            {} as any,
            addressService as any,
        );
    });

    it('should add a user address inside a transaction', async () => {
        const tx = {
            userAddress: {
                create: jest.fn().mockResolvedValue({ id: 5 }),
                findFirst: jest.fn().mockResolvedValue({
                    id: 5,
                    title: 'Home',
                    address: { fullText: '123 Main' },
                }),
            },
        };
        prismaService.client.user.findFirst.mockResolvedValueOnce({ id: 99 });
        prismaService.transaction.mockImplementationOnce((callback: any) =>
            callback(tx),
        );
        addressService.createAddress.mockResolvedValueOnce({ id: 10 });

        const result = await service.addUserAddress(99, {
            title: 'Home',
            address: {
                title: 'Home',
                latitude: 10.7,
                longitude: 106.6,
                fullText: '123 Main',
            } as any,
        });

        expect(addressService.createAddress).toHaveBeenCalledWith(
            {
                title: 'Home',
                latitude: 10.7,
                longitude: 106.6,
                fullText: '123 Main',
            },
            tx,
        );
        expect(tx.userAddress.create).toHaveBeenCalledWith({
            data: {
                title: 'Home',
                addressId: 10,
                userId: 99,
            },
        });
        expect(result).toEqual({
            id: 5,
            title: 'Home',
            address: { fullText: '123 Main' },
        });
    });

    it('should reject adding an address for a missing user', async () => {
        prismaService.client.user.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.addUserAddress(99, { title: 'Home', address: {} as any }),
        ).rejects.toThrow(UnauthorizedException);
    });

    it('should list all non-deleted addresses for a user', async () => {
        prismaService.client.user.findFirst.mockResolvedValueOnce({ id: 99 });
        prismaService.client.userAddress.findMany.mockResolvedValueOnce([
            { id: 1, title: 'Home', address: { fullText: '123 Main' } },
        ]);

        const result = await service.getAllAddress(99);

        expect(prismaService.client.userAddress.findMany).toHaveBeenCalledWith({
            where: { userId: 99, deleteAt: null },
            select: {
                id: true,
                title: true,
                address: true,
            },
        });
        expect(result).toEqual([
            { id: 1, title: 'Home', address: { fullText: '123 Main' } },
        ]);
    });

    it('should update address title and address record inside a transaction', async () => {
        const tx = {
            userAddress: {
                update: jest.fn().mockResolvedValue({ id: 5 }),
                findFirst: jest.fn().mockResolvedValue({
                    id: 5,
                    title: 'Office',
                    address: { fullText: '456 Office' },
                }),
            },
        };
        prismaService.client.userAddress.findFirst.mockResolvedValueOnce({
            id: 5,
            userId: 99,
        });
        prismaService.transaction.mockImplementationOnce((callback: any) =>
            callback(tx),
        );
        addressService.createAddress.mockResolvedValueOnce({ id: 20 });

        const result = await service.updateUserAddress(5, 99, {
            title: 'Office',
            address: {
                title: 'Office',
                latitude: 10.8,
                longitude: 106.7,
                fullText: '456 Office',
            } as any,
        });

        expect(tx.userAddress.update).toHaveBeenCalledWith({
            where: {
                id: 5,
                userId: 99,
            },
            data: {
                title: 'Office',
                addressId: 20,
            },
        });
        expect(result).toEqual({
            id: 5,
            title: 'Office',
            address: { fullText: '456 Office' },
        });
    });

    it('should reject an address update when no supported fields are provided', async () => {
        prismaService.client.userAddress.findFirst.mockResolvedValueOnce({
            id: 5,
            userId: 99,
        });

        await expect(service.updateUserAddress(5, 99, {})).rejects.toThrow(
            BadRequestException,
        );
    });

    it('should return a single user address by id', async () => {
        prismaService.client.userAddress.findFirst.mockResolvedValueOnce({
            id: 5,
            title: 'Home',
            address: { fullText: '123 Main' },
        });

        const result = await service.getUserAddressById(5, 99);

        expect(prismaService.client.userAddress.findFirst).toHaveBeenCalledWith({
            where: { id: 5, userId: 99, deleteAt: null },
            select: {
                id: true,
                title: true,
                address: true,
            },
        });
        expect(result).toEqual({
            id: 5,
            title: 'Home',
            address: { fullText: '123 Main' },
        });
    });

    it('should soft delete a user address after ownership validation', async () => {
        prismaService.client.userAddress.findFirst.mockResolvedValueOnce({
            id: 5,
            userId: 99,
        });
        prismaService.client.userAddress.update.mockResolvedValueOnce({
            id: 5,
        });

        const result = await service.deleteUserAddress(5, 99);

        expect(prismaService.client.userAddress.update).toHaveBeenCalledWith({
            where: {
                id: 5,
            },
            data: {
                deleteAt: expect.any(Date),
            },
        });
        expect(result).toEqual({
            message: 'User address deleted successfully',
            id: 5,
        });
    });

    it('should reject address operations when address does not belong to user', async () => {
        prismaService.client.userAddress.findFirst.mockResolvedValueOnce(null);

        await expect(service.deleteUserAddress(5, 99)).rejects.toThrow(
            BadRequestException,
        );
        expect(prismaService.client.userAddress.update).not.toHaveBeenCalled();
    });
});
