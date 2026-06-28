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
        ADMIN: 'ADMIN',
        CUSTOMER: 'CUSTOMER',
        BUSINESS: 'BUSINESS',
    },
}));

import { UnauthorizedException } from '@nestjs/common';
import { UserController } from './user.controller';

describe('UserController', () => {
    let controller: UserController;
    let userService: {
        uploadImages: jest.Mock;
        getAllUsers: jest.Mock;
        getUserProfile: jest.Mock;
        updateUserProfile: jest.Mock;
        addUserAddress: jest.Mock;
        getAllAddress: jest.Mock;
        getUserAddressById: jest.Mock;
        updateUserAddress: jest.Mock;
        updateUserAddressLocation: jest.Mock;
        deleteUserAddress: jest.Mock;
        getMyReviews: jest.Mock;
    };

    beforeEach(() => {
        userService = {
            uploadImages: jest.fn(),
            getAllUsers: jest.fn(),
            getUserProfile: jest.fn(),
            updateUserProfile: jest.fn(),
            addUserAddress: jest.fn(),
            getAllAddress: jest.fn(),
            getUserAddressById: jest.fn(),
            updateUserAddress: jest.fn(),
            updateUserAddressLocation: jest.fn(),
            deleteUserAddress: jest.fn(),
            getMyReviews: jest.fn(),
        };

        controller = new UserController(userService as any);
    });

    it('should forward uploaded profile image to UserService', async () => {
        const file = { originalname: 'avatar.jpg' } as any;
        userService.uploadImages.mockResolvedValue('avatar-key');

        const result = await controller.uploadImage(file);

        expect(result).toBe('avatar-key');
        expect(userService.uploadImages).toHaveBeenCalledWith(file);
    });

    it('should return all customers for admin list requests', async () => {
        userService.getAllUsers.mockResolvedValue([{ id: 1, email: 'a@test.dev' }]);

        const result = await controller.getAllCustomers();

        expect(result).toEqual([{ id: 1, email: 'a@test.dev' }]);
        expect(userService.getAllUsers).toHaveBeenCalledWith();
    });

    it('should use authenticated user id for profile reads and updates', async () => {
        const file = { originalname: 'avatar.jpg' } as any;
        const data = { name: 'New Name' };
        userService.getUserProfile.mockResolvedValue({ id: 99 });
        userService.updateUserProfile.mockResolvedValue({ id: 99, ...data });

        await expect(
            controller.getProfile({ user: { id: 99 } } as any),
        ).resolves.toEqual({ id: 99 });
        await expect(
            controller.updateUserProfile(
                { user: { id: 99 } } as any,
                data,
                file,
            ),
        ).resolves.toEqual({ id: 99, name: 'New Name' });

        expect(userService.getUserProfile).toHaveBeenCalledWith(99);
        expect(userService.updateUserProfile).toHaveBeenCalledWith(
            99,
            data,
            file,
        );
    });

    it('should reject profile requests without a valid authenticated user id', async () => {
        await expect(controller.getProfile({ user: {} } as any)).rejects.toThrow(
            UnauthorizedException,
        );
        await expect(
            controller.updateUserProfile({ user: {} } as any, {}, undefined as any),
        ).rejects.toThrow(UnauthorizedException);
    });

    it('should forward address operations with authenticated user id', async () => {
        const addressBody = {
            title: 'Home',
            address: {
                title: 'Home',
                latitude: 10.7,
                longitude: 106.6,
                fullText: '123 Main',
            },
        };
        userService.addUserAddress.mockResolvedValue({ id: 1 });
        userService.getAllAddress.mockResolvedValue([{ id: 1 }]);
        userService.getUserAddressById.mockResolvedValue({ id: 1 });
        userService.updateUserAddress.mockResolvedValue({ id: 1, title: 'Office' });
        userService.deleteUserAddress.mockResolvedValue({
            message: 'User address deleted successfully',
            id: 1,
        });

        await expect(
            controller.addUserAddress(addressBody, { user: { id: 99 } } as any),
        ).resolves.toEqual({ id: 1 });
        await expect(
            controller.getUserAllAddress({ user: { id: 99 } } as any),
        ).resolves.toEqual([{ id: 1 }]);
        await expect(
            controller.getUserAddressById(1, { user: { id: 99 } } as any),
        ).resolves.toEqual({ id: 1 });
        await expect(
            controller.updateUserAddress(
                1,
                { title: 'Office' },
                { user: { id: 99 } } as any,
            ),
        ).resolves.toEqual({ id: 1, title: 'Office' });
        await expect(
            controller.deleteUserAddress({ user: { id: 99 } } as any, 1),
        ).resolves.toEqual({
            message: 'User address deleted successfully',
            id: 1,
        });

        expect(userService.addUserAddress).toHaveBeenCalledWith(99, addressBody);
        expect(userService.getAllAddress).toHaveBeenCalledWith(99);
        expect(userService.getUserAddressById).toHaveBeenCalledWith(1, 99);
        expect(userService.updateUserAddress).toHaveBeenCalledWith(1, 99, {
            title: 'Office',
        });
        expect(userService.deleteUserAddress).toHaveBeenCalledWith(1, 99);
    });

    it('should wrap my reviews response and apply default pagination', async () => {
        userService.getMyReviews.mockResolvedValue([{ id: 12 }]);

        const result = await controller.getMyReviews(
            { user: { id: 99 } } as any,
            undefined,
            undefined,
        );

        expect(result).toEqual({
            success: true,
            data: [{ id: 12 }],
        });
        expect(userService.getMyReviews).toHaveBeenCalledWith(99, 20, 0);
    });

    it('should pass explicit my reviews pagination values', async () => {
        userService.getMyReviews.mockResolvedValue([]);

        await controller.getMyReviews({ user: { id: 99 } } as any, 5, 10);

        expect(userService.getMyReviews).toHaveBeenCalledWith(99, 5, 10);
    });
});
