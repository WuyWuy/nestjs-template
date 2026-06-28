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
        BUSINESS: 'BUSINESS',
        CUSTOMER: 'CUSTOMER',
    },
    RestaurantApprovalStatus: {
        PENDING: 'PENDING',
        APPROVED: 'APPROVED',
        REJECTED: 'REJECTED',
    },
}));

import { RestaurantController } from './restaurant.controller';

describe('RestaurantController', () => {
    let controller: RestaurantController;
    let restaurantService: {
        getMyRestaurants: jest.Mock;
        registerBusiness: jest.Mock;
        createRestaurant: jest.Mock;
        updateRestaurant: jest.Mock;
        getRestaurantDashboard: jest.Mock;
        generateRestaurantDashboard: jest.Mock;
        getRestaurantRevenue: jest.Mock;
        getRestaurantRevenueDetails: jest.Mock;
        updateRestaurantStatus: jest.Mock;
        updateRestaurantOperatingHours: jest.Mock;
        getAllRestaurants: jest.Mock;
        getRestaurantInDetail: jest.Mock;
        getRestaurantMenu: jest.Mock;
        getRestaurantRatings: jest.Mock;
        createRestaurantRating: jest.Mock;
        updateRestaurantRating: jest.Mock;
        deleteRestaurantRating: jest.Mock;
        getRestaurantRatingsForVendor: jest.Mock;
        replyToRestaurantRating: jest.Mock;
        getRestaurantRatingStats: jest.Mock;
    };

    beforeEach(() => {
        restaurantService = {
            getMyRestaurants: jest.fn(),
            registerBusiness: jest.fn(),
            createRestaurant: jest.fn(),
            updateRestaurant: jest.fn(),
            getRestaurantDashboard: jest.fn(),
            generateRestaurantDashboard: jest.fn(),
            getRestaurantRevenue: jest.fn(),
            getRestaurantRevenueDetails: jest.fn(),
            updateRestaurantStatus: jest.fn(),
            updateRestaurantOperatingHours: jest.fn(),
            getAllRestaurants: jest.fn(),
            getRestaurantInDetail: jest.fn(),
            getRestaurantMenu: jest.fn(),
            getRestaurantRatings: jest.fn(),
            createRestaurantRating: jest.fn(),
            updateRestaurantRating: jest.fn(),
            deleteRestaurantRating: jest.fn(),
            getRestaurantRatingsForVendor: jest.fn(),
            replyToRestaurantRating: jest.fn(),
            getRestaurantRatingStats: jest.fn(),
        };

        controller = new RestaurantController(restaurantService as any);
    });

    it('should register the authenticated user as a business', async () => {
        restaurantService.registerBusiness.mockResolvedValue({
            userId: 99,
            role: 'BUSINESS',
            requiresTokenRefresh: true,
        });

        const result = await controller.registerBusiness({
            user: { id: 99, roles: ['CUSTOMER'] },
        } as any);

        expect(restaurantService.registerBusiness).toHaveBeenCalledWith(99);
        expect(result.role).toBe('BUSINESS');
    });

    it('should pass actor id and roles when listing owned restaurants', async () => {
        restaurantService.getMyRestaurants.mockResolvedValue([{ id: 1 }]);

        const result = await controller.getMyRestaurants({
            user: { id: 99, roles: ['BUSINESS'] },
        } as any);

        expect(result).toEqual([{ id: 1 }]);
        expect(restaurantService.getMyRestaurants).toHaveBeenCalledWith(99, [
            'BUSINESS',
        ]);
    });

    it('should pass actor id, roles, body and files when creating a restaurant', async () => {
        const data = { name: 'Burger Town', phone: '02873000001', addressId: 1 };
        const files = { image: [{ originalname: 'logo.jpg' }] } as any;
        restaurantService.createRestaurant.mockResolvedValue({ id: 1, ...data });

        const result = await controller.createRestaurant(
            { user: { id: 99, roles: ['BUSINESS'] } } as any,
            data as any,
            files,
        );

        expect(result).toEqual({ id: 1, ...data });
        expect(restaurantService.createRestaurant).toHaveBeenCalledWith(
            99,
            data,
            ['BUSINESS'],
            files,
        );
    });

    it('should pass actor id, roles, restaurant id, body and files when updating a restaurant', async () => {
        const data = { name: 'Burger Express' };
        const files = { coverImage: [{ originalname: 'cover.jpg' }] } as any;
        restaurantService.updateRestaurant.mockResolvedValue({ id: 1, ...data });

        const result = await controller.updateRestaurant(
            { user: { id: 99, roles: ['BUSINESS'] } } as any,
            1,
            data,
            files,
        );

        expect(result).toEqual({ id: 1, ...data });
        expect(restaurantService.updateRestaurant).toHaveBeenCalledWith(
            99,
            ['BUSINESS'],
            1,
            data,
            files,
        );
    });

    it('should generate the restaurant dashboard for the authenticated owner', async () => {
        const dashboard = {
            runningOrders: 2,
            orderRequest: 1,
            revenue: 2241,
            rating: 4.9,
            totalReviews: 25,
            totalOrders: 142,
            activeVouchers: 3,
            recentOrders: [],
            bestSellers: [],
        };
        restaurantService.generateRestaurantDashboard.mockResolvedValue(
            dashboard,
        );

        await expect(
            controller.generateRestaurantDashboard(
                { user: { id: 99, roles: ['BUSINESS'] } } as any,
                101,
            ),
        ).resolves.toEqual(dashboard);
        expect(
            restaurantService.generateRestaurantDashboard,
        ).toHaveBeenCalledWith(101, 99, ['BUSINESS']);
    });

    it('should use default public list query values and optional user id', async () => {
        restaurantService.getAllRestaurants.mockResolvedValue([{ id: 1 }]);

        const result = await controller.getAllRestauant(
            {},
            { user: { id: 77 } } as any,
        );

        expect(result).toEqual([{ id: 1 }]);
        expect(restaurantService.getAllRestaurants).toHaveBeenCalledWith(
            20,
            0,
            '',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            77,
            [],
            undefined,
        );
    });

    it('should forward detail, menu and public reviews requests', async () => {
        restaurantService.getRestaurantInDetail.mockResolvedValue({ id: 1 });
        restaurantService.getRestaurantMenu.mockResolvedValue({ foods: [] });
        restaurantService.getRestaurantRatings.mockResolvedValue({ ratings: [] });

        await expect(controller.getRestaurantDetail(1)).resolves.toEqual({
            id: 1,
        });
        await expect(
            controller.getRestaurantMenu(1, { keyword: 'pho', categoryId: 2 }),
        ).resolves.toEqual({ foods: [] });
        await expect(controller.getRestaurantReviews(1)).resolves.toEqual({
            ratings: [],
        });

        expect(restaurantService.getRestaurantInDetail).toHaveBeenCalledWith(1);
        expect(restaurantService.getRestaurantMenu).toHaveBeenCalledWith(
            1,
            'pho',
            2,
        );
        expect(restaurantService.getRestaurantRatings).toHaveBeenCalledWith(1);
    });

    it('should pass customer id when creating, updating and deleting reviews', async () => {
        restaurantService.createRestaurantRating.mockResolvedValue({ id: 10 });
        restaurantService.updateRestaurantRating.mockResolvedValue({
            id: 10,
            vote: 4,
            comment: 'Good',
            tags: ['Mon an ngon'],
        });
        restaurantService.deleteRestaurantRating.mockResolvedValue({
            success: true,
        });

        await expect(
            controller.createRestaurantReview(
                1,
                { orderId: 123, vote: 5 } as any,
                { user: { id: 77 } } as any,
            ),
        ).resolves.toEqual({ id: 10 });
        await expect(
            controller.updateRestaurantReview(
                10,
                { vote: 4 } as any,
                { user: { id: 77 } } as any,
            ),
        ).resolves.toEqual({
            success: true,
            message: 'Update review successfully',
            data: expect.objectContaining({
                id: 10,
                vote: 4,
                comment: 'Good',
                tags: ['Mon an ngon'],
            }),
        });
        await expect(
            controller.deleteRestaurantReview(10, {
                user: { id: 77, roles: ['CUSTOMER'] },
            } as any),
        ).resolves.toEqual({ success: true });

        expect(restaurantService.createRestaurantRating).toHaveBeenCalledWith(
            1,
            77,
            { orderId: 123, vote: 5 },
        );
        expect(restaurantService.updateRestaurantRating).toHaveBeenCalledWith(
            10,
            77,
            { vote: 4 },
        );
        expect(restaurantService.deleteRestaurantRating).toHaveBeenCalledWith(
            10,
            77,
            ['CUSTOMER'],
        );
    });

    it('should wrap vendor review list, reply and rating stats responses', async () => {
        restaurantService.getRestaurantRatingsForVendor.mockResolvedValue([
            { id: 10 },
        ]);
        restaurantService.replyToRestaurantRating.mockResolvedValue({
            id: 10,
            reply: 'Thanks',
            replyCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
        });
        restaurantService.getRestaurantRatingStats.mockResolvedValue({
            totalReviews: 1,
        });

        await expect(
            controller.getRestaurantReviewsForVendor(1, {
                user: { id: 99, roles: ['BUSINESS'] },
            } as any),
        ).resolves.toEqual({ success: true, data: [{ id: 10 }] });
        await expect(
            controller.replyToRestaurantReview(
                10,
                { reply: 'Thanks' },
                { user: { id: 99, roles: ['BUSINESS'] } } as any,
            ),
        ).resolves.toEqual({
            success: true,
            message: 'Reply added successfully',
            data: {
                id: 10,
                reply: 'Thanks',
                replyCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
            },
        });
        await expect(
            controller.getRestaurantRatingStats(1, {
                user: { id: 99, roles: ['BUSINESS'] },
            } as any),
        ).resolves.toEqual({ success: true, data: { totalReviews: 1 } });
    });

    it('should forward revenue summary query params to the service', async () => {
        const response = {
            success: true,
            data: { grossRevenue: 1000 },
        };
        restaurantService.getRestaurantRevenue.mockResolvedValue(response);
        const query = {
            startDate: '2026-06-01',
            endDate: '2026-06-30',
        };

        await expect(
            controller.getRestaurantRevenue(
                { user: { id: 99, roles: ['BUSINESS'] } } as any,
                101,
                query,
            ),
        ).resolves.toEqual(response);
        expect(restaurantService.getRestaurantRevenue).toHaveBeenCalledWith(
            101,
            99,
            ['BUSINESS'],
            query,
        );
    });

    it('should forward revenue detail query params to the service', async () => {
        const response = {
            success: true,
            data: [],
            total: 0,
            limit: 10,
            offset: 0,
        };
        restaurantService.getRestaurantRevenueDetails.mockResolvedValue(
            response,
        );
        const query = { limit: 10, offset: 0 };

        await expect(
            controller.getRestaurantRevenueDetails(
                { user: { id: 99, roles: ['BUSINESS'] } } as any,
                101,
                query,
            ),
        ).resolves.toEqual(response);
        expect(
            restaurantService.getRestaurantRevenueDetails,
        ).toHaveBeenCalledWith(101, 99, ['BUSINESS'], query);
    });
});
