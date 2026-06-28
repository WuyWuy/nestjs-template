jest.mock('@prisma/client', () => ({
    Role: {
        CUSTOMER: 'CUSTOMER',
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

import { FavoriteController } from './favorite.controller';

describe('FavoriteController', () => {
    let controller: FavoriteController;
    let favoriteService: {
        toggleFavorite: jest.Mock;
        getFavorites: jest.Mock;
        getLikeStatus: jest.Mock;
    };

    beforeEach(() => {
        favoriteService = {
            toggleFavorite: jest.fn(),
            getFavorites: jest.fn(),
            getLikeStatus: jest.fn(),
        };

        controller = new FavoriteController(favoriteService as any);
    });

    it('should toggle favorite with authenticated user id and wrap service result', async () => {
        const serviceResult = {
            restaurantId: 101,
            isLiked: true,
            totalLikes: 15,
        };
        favoriteService.toggleFavorite.mockResolvedValueOnce(serviceResult);

        const result = await controller.toggleFavorite(101, {
            user: { id: 1 },
        } as any);

        expect(favoriteService.toggleFavorite).toHaveBeenCalledWith(1, 101);
        expect(result).toEqual({
            success: true,
            message: 'Update favorite status successfully',
            data: serviceResult,
        });
    });

    it('should get favorites using provided pagination', async () => {
        const serviceResult = {
            data: [],
            pagination: {
                total: 0,
                limit: 10,
                offset: 5,
            },
        };
        favoriteService.getFavorites.mockResolvedValueOnce(serviceResult);

        const result = await controller.getFavorites(
            { limit: 10, offset: 5 },
            { user: { id: 1 } } as any,
        );

        expect(favoriteService.getFavorites).toHaveBeenCalledWith(1, 10, 5);
        expect(result).toEqual(serviceResult);
    });

    it('should get favorites using default pagination', async () => {
        const serviceResult = {
            data: [],
            pagination: {
                total: 0,
                limit: 20,
                offset: 0,
            },
        };
        favoriteService.getFavorites.mockResolvedValueOnce(serviceResult);

        const result = await controller.getFavorites(
            {},
            { user: { id: 1 } } as any,
        );

        expect(favoriteService.getFavorites).toHaveBeenCalledWith(1, 20, 0);
        expect(result).toEqual(serviceResult);
    });

    it('should return like status for authenticated user and restaurant', async () => {
        favoriteService.getLikeStatus.mockResolvedValueOnce({ isLiked: true });

        const result = await controller.getLikeStatus(101, {
            user: { id: 1 },
        } as any);

        expect(favoriteService.getLikeStatus).toHaveBeenCalledWith(1, 101);
        expect(result).toEqual({ isLiked: true });
    });
});
