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
    OrderStatus: {
        PENDING: 'PENDING',
        CONFIRMED: 'CONFIRMED',
        PREPARING: 'PREPARING',
        DELIVERING: 'DELIVERING',
        DELIVERED: 'DELIVERED',
        CANCELLED: 'CANCELLED',
    },
    PaymentStatus: {
        UNPAID: 'UNPAID',
        DONE: 'DONE',
    },
    NotificationType: {
        SYSTEM: 'SYSTEM',
        ORDER: 'ORDER',
        PAYMENT: 'PAYMENT',
        PROMOTION: 'PROMOTION',
        CHAT: 'CHAT',
    },
}));

import { RestaurantService } from './restaurant.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('RestaurantService - createRestaurantRating', () => {
    let service: RestaurantService;
    let prismaService: any;
    let eventEmitter: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findFirst: jest.fn(),
                },
                order: {
                    findFirst: jest.fn(),
                },
                restaurantRating: {
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                    delete: jest.fn(),
                },
            },
        };
        eventEmitter = {
            emit: jest.fn(),
        };

        service = new RestaurantService(
            prismaService,
            {} as any, // auditService mock
            {} as any, // minioService mock
            eventEmitter,
        );
    });

    it('should successfully create a new rating if all rules are satisfied', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 2,
            name: 'Burger Town',
        });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 101,
            userId: 5,
            status: 'CONFIRMED',
        });
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce(null);
        prismaService.client.restaurantRating.create.mockResolvedValueOnce({
            id: 12,
            restaurantId: 101,
            userId: 5,
            vote: 5,
            comment: 'Ngon',
            orderId: 162432,
            tags: ['Delicious food'],
        });

        const result = await service.createRestaurantRating(101, 5, {
            orderId: 162432,
            vote: 5,
            comment: 'Ngon',
            tags: ['Delicious food'],
        });

        expect(result).toBeDefined();
        expect(prismaService.client.restaurantRating.create).toHaveBeenCalledWith({
            data: {
                restaurantId: 101,
                userId: 5,
                vote: 5,
                comment: 'Ngon',
                orderId: 162432,
                tags: ['Delicious food'],
            },
        });
        expect(eventEmitter.emit).toHaveBeenCalledWith('notification.send', expect.any(Object));
    });

    it('should throw NotFoundException if restaurant does not exist or is not approved', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if order does not exist', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if order does not belong to the user', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 101,
            userId: 99, // belongs to user 99, but user 5 is rating
            status: 'CONFIRMED',
        });

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if order does not belong to the restaurant', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 999, // order is for restaurant 999, but rating is for 101
            userId: 5,
            status: 'CONFIRMED',
        });

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if order status is not CONFIRMED', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 101,
            userId: 5,
            status: 'PREPARING',
        });

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if order has already been rated', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 101,
            userId: 5,
            status: 'CONFIRMED',
        });
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            orderId: 162432,
        });

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if invalid review tags are provided', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({ id: 101 });
        prismaService.client.order.findFirst.mockResolvedValueOnce({
            id: 162432,
            restaurantId: 101,
            userId: 5,
            status: 'CONFIRMED',
        });
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.createRestaurantRating(101, 5, {
                orderId: 162432,
                vote: 5,
                tags: ['Giao quá trễ'], // invalid tag
            }),
        ).rejects.toThrow(BadRequestException);
    });
});

describe('RestaurantService - updateRestaurantRating', () => {
    let service: RestaurantService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurantRating: {
                    findFirst: jest.fn(),
                    update: jest.fn(),
                },
            },
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('should successfully update review fields if user is the owner', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 5,
        });
        prismaService.client.restaurantRating.update.mockResolvedValueOnce({
            id: 12,
            userId: 5,
            vote: 4,
            comment: 'Ngon nhung giao hoi cham',
            tags: ['Delicious food'],
        });

        const result = await service.updateRestaurantRating(12, 5, {
            vote: 4,
            comment: 'Ngon nhung giao hoi cham',
            tags: ['Delicious food'],
        });

        expect(result.vote).toBe(4);
        expect(prismaService.client.restaurantRating.update).toHaveBeenCalledWith({
            where: { id: 12 },
            data: {
                vote: 4,
                comment: 'Ngon nhung giao hoi cham',
                tags: ['Delicious food'],
            },
        });
    });

    it('should throw NotFoundException if review does not exist', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.updateRestaurantRating(12, 5, {
                vote: 4,
            }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner of the review', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 99, // user 99 owns it, but user 5 wants to update
        });

        await expect(
            service.updateRestaurantRating(12, 5, {
                vote: 4,
            }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if invalid review tags are provided', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 5,
        });

        await expect(
            service.updateRestaurantRating(12, 5, {
                tags: ['Giao quá trễ'],
            }),
        ).rejects.toThrow(BadRequestException);
    });
});

describe('RestaurantService - deleteRestaurantRating', () => {
    let service: RestaurantService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurantRating: {
                    findFirst: jest.fn(),
                    delete: jest.fn(),
                },
            },
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('should successfully delete review if user is the owner', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 5,
        });

        const result = await service.deleteRestaurantRating(12, 5, ['CUSTOMER']);

        expect(result.success).toBe(true);
        expect(prismaService.client.restaurantRating.delete).toHaveBeenCalledWith({
            id: 12,
        });
    });

    it('should successfully delete review if user is an ADMIN (even if not owner)', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 99, // belongs to user 99, but deleted by ADMIN
        });

        const result = await service.deleteRestaurantRating(12, 5, ['ADMIN']);

        expect(result.success).toBe(true);
        expect(prismaService.client.restaurantRating.delete).toHaveBeenCalledWith({
            id: 12,
        });
    });

    it('should throw NotFoundException if review does not exist', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.deleteRestaurantRating(12, 5, ['CUSTOMER']),
        ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not the owner and not an ADMIN', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            userId: 99,
        });

        await expect(
            service.deleteRestaurantRating(12, 5, ['CUSTOMER']),
        ).rejects.toThrow(ForbiddenException);
    });
});

describe('RestaurantService - getRestaurantRatingsForVendor', () => {
    let service: RestaurantService;
    let prismaService: any;
    let minioService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findFirst: jest.fn(),
                },
                restaurantRating: {
                    findMany: jest.fn(),
                },
            },
        };
        minioService = {
            getFileUrl: jest.fn(async (file) => `http://localhost/${file}`),
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            minioService,
            {} as any,
        );
    });

    it('should successfully return restaurant reviews for the restaurant owner', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 2,
        });

        prismaService.client.restaurantRating.findMany.mockResolvedValueOnce([
            {
                id: 12,
                vote: 5,
                comment: 'Ngon',
                tags: ['Thuc an ngon'],
                createdAt: new Date(),
                reply: null,
                orderId: 162432,
                user: {
                    id: 5,
                    name: 'Nguyen Van A',
                    avatar: 'avatar.jpg',
                },
            },
        ]);

        const result = await service.getRestaurantRatingsForVendor(101, 2, ['BUSINESS']);

        expect(result.length).toBe(1);
        expect(result[0].user.avatar).toBe('http://localhost/avatar.jpg');
        expect(prismaService.client.restaurantRating.findMany).toHaveBeenCalledWith({
            where: {
                restaurantId: 101,
                deleteAt: null,
            },
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatar: true,
                    },
                },
            },
        });
    });

    it('should throw ForbiddenException if user is not the owner and not an admin', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 2,
        });

        await expect(
            service.getRestaurantRatingsForVendor(101, 99, ['BUSINESS']),
        ).rejects.toThrow(ForbiddenException);
    });
});

describe('RestaurantService - getRestaurantRatingStats', () => {
    let service: RestaurantService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findFirst: jest.fn(),
                },
                restaurantRating: {
                    findMany: jest.fn(),
                },
            },
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('should successfully calculate stats from ratings list', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 2,
        });

        prismaService.client.restaurantRating.findMany.mockResolvedValueOnce([
            { vote: 5, tags: ['Thuc an ngon', 'Giao hang nhanh'] },
            { vote: 5, tags: ['Thuc an ngon'] },
            { vote: 3, tags: ['Giao hang nhanh'] },
        ]);

        const result = await service.getRestaurantRatingStats(101, 2, ['BUSINESS']);

        expect(result).toEqual({
            averageRating: 4.3,
            totalReviews: 3,
            starCount: {
                '1': 0,
                '2': 0,
                '3': 1,
                '4': 0,
                '5': 2,
            },
            popularTags: [
                { tag: 'Thuc an ngon', count: 2 },
                { tag: 'Giao hang nhanh', count: 2 },
            ],
        });
    });

    it('should throw ForbiddenException if user is not authorized', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 2,
        });

        await expect(
            service.getRestaurantRatingStats(101, 99, ['BUSINESS']),
        ).rejects.toThrow(ForbiddenException);
    });
});

describe('RestaurantService - getAllRestaurants', () => {
    let service: RestaurantService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findMany: jest.fn(),
                },
                userFavoriteRestaurant: {
                    findMany: jest.fn(),
                },
            },
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('should return list of restaurants with isLiked: false if userId is not provided', async () => {
        const mockRestaurants = [
            {
                id: 101,
                name: 'Pizza Shop',
                image: 'pizza.jpg',
                deliveryFee: 1.5,
                ratings: [],
                foods: [],
                createdAt: new Date(),
            },
        ];

        prismaService.client.restaurant.findMany.mockResolvedValueOnce(mockRestaurants);

        const result = await service.getAllRestaurants(20, 0, '', undefined, undefined, undefined, undefined, undefined);

        expect(result).toHaveLength(1);
        expect(result[0].isLiked).toBe(false);
    });

    it('should return list of restaurants with correct isLiked value if userId is provided', async () => {
        const mockRestaurants = [
            {
                id: 101,
                name: 'Pizza Shop',
                image: 'pizza.jpg',
                deliveryFee: 1.5,
                ratings: [],
                foods: [],
                createdAt: new Date(),
            },
            {
                id: 102,
                name: 'Burger Shop',
                image: 'burger.jpg',
                deliveryFee: 2.0,
                ratings: [],
                foods: [],
                createdAt: new Date(),
            },
        ];

        const mockFavorites = [
            { restaurantId: 101 },
        ];

        prismaService.client.restaurant.findMany.mockResolvedValueOnce(mockRestaurants);
        prismaService.client.userFavoriteRestaurant.findMany.mockResolvedValueOnce(mockFavorites);

        const result = await service.getAllRestaurants(20, 0, '', undefined, undefined, undefined, undefined, undefined, 5);

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe(101);
        expect(result[0].isLiked).toBe(true);
        expect(result[1].id).toBe(102);
        expect(result[1].isLiked).toBe(false);

        expect(prismaService.client.userFavoriteRestaurant.findMany).toHaveBeenCalledWith({
            where: {
                userId: 5,
                restaurantId: { in: [101, 102] },
            },
            select: { restaurantId: true },
        });
    });
});

describe('RestaurantService - menu and details', () => {
    let service: RestaurantService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findFirst: jest.fn(),
                },
            },
        };

        service = new RestaurantService(
            prismaService,
            {} as any,
            {} as any,
            {} as any,
        );
    });

    it('should return restaurant menu filtered by keyword and category', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            name: 'Burger Town',
            status: 'APPROVED',
            foods: [{ id: 1, name: 'Cheese Burger' }],
        });

        const result = await service.getRestaurantMenu(101, 'burger', 2);

        expect(prismaService.client.restaurant.findFirst).toHaveBeenCalledWith({
            where: {
                id: 101,
                status: 'APPROVED',
                isActive: true,
            },
            select: expect.objectContaining({
                id: true,
                name: true,
                status: true,
                foods: expect.objectContaining({
                            where: {
                                deleteAt: null,
                                isAvailable: true,
                                category: {
                                    isActive: true,
                                    deleteAt: null,
                                },
                                name: {
                            contains: 'burger',
                            mode: 'insensitive',
                        },
                        categoryId: 2,
                    },
                }),
            }),
        });
        expect(result).toEqual({
            id: 101,
            name: 'Burger Town',
            status: 'APPROVED',
            foods: [{ id: 1, name: 'Cheese Burger' }],
        });
    });

    it('should throw NotFoundException when menu restaurant is missing', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce(null);

        await expect(service.getRestaurantMenu(404, '', undefined)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should return restaurant detail with numeric fees, rating summary and categories', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            name: 'Burger Town',
            deliveryFee: '2.50',
            minimumOrder: '10.00',
            foods: [
                {
                    id: 1,
                    name: 'Cheese Burger',
                    category: { id: 2, name: 'Burger' },
                },
                {
                    id: 2,
                    name: 'Double Burger',
                    category: { id: 2, name: 'Burger' },
                },
            ],
            ratings: [{ vote: 5 }, { vote: 4 }],
        });

        const result = await service.getRestaurantInDetail(101);

        expect(result).toEqual(
            expect.objectContaining({
                id: 101,
                deliveryFee: 2.5,
                minimumOrder: 10,
                averageRating: 4.5,
                ratingCount: 2,
                categories: [{ id: 2, name: 'Burger' }],
            }),
        );
    });
});

describe('RestaurantService - management', () => {
    let service: RestaurantService;
    let prismaService: any;
    let auditService: { log: jest.Mock };
    let minioService: { uploadFile: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                address: {
                    findFirst: jest.fn(),
                },
                user: {
                    findFirst: jest.fn(),
                },
                userRole: {
                    findFirst: jest.fn(),
                    create: jest.fn(),
                },
                restaurant: {
                    findFirst: jest.fn(),
                    findMany: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                },
                order: {
                    aggregate: jest.fn(),
                    count: jest.fn(),
                    findMany: jest.fn(),
                },
            },
        };
        auditService = {
            log: jest.fn(),
        };
        minioService = {
            uploadFile: jest.fn(),
        };

        service = new RestaurantService(
            prismaService,
            auditService as any,
            minioService as any,
            {} as any,
        );
    });

    it('should register a customer as business immediately', async () => {
        prismaService.client.user.findFirst.mockResolvedValueOnce({
            id: 99,
            phone: '0901234567',
        });
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce(null);
        prismaService.client.userRole.findFirst.mockResolvedValueOnce(null);
        prismaService.client.userRole.create.mockResolvedValueOnce({
            userId: 99,
            role: 'BUSINESS',
        });

        const result = await service.registerBusiness(99);

        expect(prismaService.client.userRole.create).toHaveBeenCalledWith({
            data: {
                userId: 99,
                role: 'BUSINESS',
            },
        });
        expect(result).toEqual({
            userId: 99,
            role: 'BUSINESS',
            requiresTokenRefresh: true,
        });
    });

    it('should reject business registration when the user already owns a restaurant', async () => {
        prismaService.client.user.findFirst.mockResolvedValueOnce({
            id: 99,
            phone: '0901234567',
        });
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
        });

        await expect(service.registerBusiness(99)).rejects.toThrow(
            BadRequestException,
        );
    });

    it('should list only owned restaurants for business users and convert money fields to numbers', async () => {
        prismaService.client.restaurant.findMany.mockResolvedValueOnce([
            {
                id: 101,
                name: 'Burger Town',
                deliveryFee: '2.50',
                minimumOrder: '10.00',
            },
        ]);

        const result = await service.getMyRestaurants(99, ['BUSINESS']);

        expect(prismaService.client.restaurant.findMany).toHaveBeenCalledWith({
            where: {
                ownerId: 99,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        expect(result).toEqual([
            {
                id: 101,
                name: 'Burger Town',
                deliveryFee: 2.5,
                minimumOrder: 10,
            },
        ]);
    });

    it('should allow admins to list all restaurants', async () => {
        prismaService.client.restaurant.findMany.mockResolvedValueOnce([]);

        await service.getMyRestaurants(1, ['ADMIN']);

        expect(prismaService.client.restaurant.findMany).toHaveBeenCalledWith({
            where: undefined,
            orderBy: {
                createdAt: 'desc',
            },
        });
    });

    it('should reject restaurant creation for users without business or admin role', async () => {
        await expect(
            service.createRestaurant(
                99,
                {
                    name: 'Burger Town',
                    phone: '02873000001',
                    addressId: 1,
                } as any,
                ['CUSTOMER'],
            ),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should create a restaurant with uploaded images and write an audit log', async () => {
        const imageFile = { originalname: 'logo.jpg' } as any;
        const coverFile = { originalname: 'cover.jpg' } as any;
        const data = {
            name: 'Burger Town',
            phone: '02873000001',
            addressId: 1,
            description: 'Fast casual',
            deliveryFee: 2,
            minimumOrder: 8,
            estimatedDeliveryTime: 25,
        };
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce(null);
        prismaService.client.address.findFirst.mockResolvedValueOnce({ id: 1 });
        minioService.uploadFile
            .mockResolvedValueOnce('https://cdn.example.com/logo.jpg')
            .mockResolvedValueOnce('https://cdn.example.com/cover.jpg');
        prismaService.client.restaurant.create.mockResolvedValueOnce({
            id: 101,
            ...data,
            image: 'https://cdn.example.com/logo.jpg',
            coverImage: 'https://cdn.example.com/cover.jpg',
            ownerId: 99,
            status: 'PENDING',
        });

        const result = await service.createRestaurant(99, data as any, ['BUSINESS'], {
            image: [imageFile],
            coverImage: [coverFile],
        });

        expect(prismaService.client.address.findFirst).toHaveBeenCalledWith({
            where: { id: 1 },
            select: { id: true },
        });
        expect(prismaService.client.restaurant.create).toHaveBeenCalledWith({
            data: {
                name: 'Burger Town',
                phone: '02873000001',
                addressId: 1,
                description: 'Fast casual',
                image: 'https://cdn.example.com/logo.jpg',
                coverImage: 'https://cdn.example.com/cover.jpg',
                deliveryFee: 2,
                minimumOrder: 8,
                estimatedDeliveryTime: 25,
                ownerId: 99,
                status: 'PENDING',
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'CREATE_RESTAURANT',
            'Restaurant',
            101,
            99,
            data,
        );
        expect(result.id).toBe(101);
    });

    it('should reject restaurant creation when the owner or phone is already registered', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 99,
            phone: '02873000001',
        });

        await expect(
            service.createRestaurant(
                99,
                {
                    name: 'Burger Town',
                    phone: '02873000001',
                    addressId: 1,
                } as any,
                ['BUSINESS'],
            ),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when creating with a missing address', async () => {
        prismaService.client.address.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.createRestaurant(
                99,
                {
                    name: 'Burger Town',
                    phone: '02873000001',
                    addressId: 404,
                } as any,
                ['BUSINESS'],
            ),
        ).rejects.toThrow(BadRequestException);
    });

    it('should update an owned restaurant with uploaded image and write an audit log', async () => {
        const data = {
            name: 'Burger Express',
            addressId: 2,
            deliveryFee: 3,
        };
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 99,
        });
        prismaService.client.address.findFirst.mockResolvedValueOnce({ id: 2 });
        minioService.uploadFile.mockResolvedValueOnce(
            'https://cdn.example.com/new-logo.jpg',
        );
        prismaService.client.restaurant.update.mockResolvedValueOnce({
            id: 101,
            ...data,
            image: 'https://cdn.example.com/new-logo.jpg',
        });

        const result = await service.updateRestaurant(
            99,
            ['BUSINESS'],
            101,
            data as any,
            { image: [{ originalname: 'new-logo.jpg' } as any] },
        );

        expect(prismaService.client.restaurant.update).toHaveBeenCalledWith({
            where: {
                id: 101,
            },
            data: {
                name: 'Burger Express',
                addressId: 2,
                image: 'https://cdn.example.com/new-logo.jpg',
                deliveryFee: 3,
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'UPDATE_RESTAURANT',
            'Restaurant',
            101,
            99,
            data,
        );
        expect(result.id).toBe(101);
    });

    it('should move a rejected restaurant back to pending after an update', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 99,
            status: 'REJECTED',
        });
        prismaService.client.restaurant.update.mockResolvedValueOnce({
            id: 101,
            name: 'Burger Revised',
            status: 'PENDING',
        });

        await service.updateRestaurant(
            99,
            ['BUSINESS'],
            101,
            { name: 'Burger Revised' },
        );

        expect(prismaService.client.restaurant.update).toHaveBeenCalledWith({
            where: {
                id: 101,
            },
            data: {
                name: 'Burger Revised',
                status: 'PENDING',
            },
        });
    });

    it('should throw ForbiddenException when updating another owner restaurant', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 55,
        });

        await expect(
            service.updateRestaurant(99, ['BUSINESS'], 101, { name: 'Nope' }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when update payload has no supported fields', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 99,
        });

        await expect(
            service.updateRestaurant(99, ['BUSINESS'], 101, {}),
        ).rejects.toThrow(BadRequestException);
    });

    it('should calculate dashboard metrics from delivered and cancelled orders', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 99,
        });
        prismaService.client.order.findMany.mockResolvedValueOnce([
            {
                status: 'CONFIRMED',
                totalPrice: '30.50',
                orderFoods: [
                    {
                        foodId: 1,
                        quantity: 2,
                        price: '20',
                        food: { name: 'Burger', image: 'burger.jpg' },
                    },
                    {
                        foodId: 2,
                        quantity: 1,
                        price: '10.50',
                        food: { name: 'Fries', image: 'fries.jpg' },
                    },
                ],
            },
            {
                status: 'CANCELLED',
                totalPrice: '12',
                orderFoods: [],
            },
        ]);

        const result = await service.getRestaurantDashboard(
            101,
            99,
            ['BUSINESS'],
            'day',
        );

        expect(result).toEqual({
            deliveredRevenue: 30.5,
            deliveredOrderCount: 1,
            cancelledOrderCount: 1,
            topFoods: [
                {
                    id: 1,
                    name: 'Burger',
                    image: 'burger.jpg',
                    quantity: 2,
                    revenue: 20,
                },
                {
                    id: 2,
                    name: 'Fries',
                    image: 'fries.jpg',
                    quantity: 1,
                    revenue: 10.5,
                },
            ],
        });
    });

    it('should calculate revenue split and write an audit log', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 99,
        });
        prismaService.client.order.aggregate.mockResolvedValueOnce({
            _sum: {
                totalPrice: '125.50',
            },
        });
        prismaService.client.order.count.mockResolvedValueOnce(3);

        const result = await service.getRestaurantRevenue(101, 99, ['BUSINESS'], {
            startDate: '2026-06-01',
            endDate: '2026-06-30',
        });

        expect(prismaService.client.order.aggregate).toHaveBeenCalledWith({
            where: {
                restaurantId: 101,
                status: 'CONFIRMED',
                deleteAt: null,
                confirmedAt: {
                    gte: new Date('2026-06-01T00:00:00.000Z'),
                    lte: new Date('2026-06-30T23:59:59.999Z'),
                },
                payments: {
                    some: {
                        paymentStatus: 'DONE',
                    },
                },
            },
            _sum: {
                totalPrice: true,
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'VIEW_RESTAURANT_REVENUE',
            'Restaurant',
            101,
            99,
            {
                filters: {
                    startDate: '2026-06-01',
                    endDate: '2026-06-30',
                },
            },
        );
        expect(result).toEqual({
            success: true,
            data: {
                restaurantId: 101,
                grossRevenue: 125.5,
                platformCommissionRate: 0.1,
                platformCommission: 12.55,
                restaurantNetRevenue: 112.95,
                orderCount: 3,
                filters: {
                    startDate: '2026-06-01T00:00:00.000Z',
                    endDate: '2026-06-30T23:59:59.999Z',
                },
            },
        });
    });

    it('should return paginated restaurant revenue details', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 99,
        });
        prismaService.client.order.findMany.mockResolvedValueOnce([
            {
                id: 10023,
                totalPrice: '250000',
                confirmedAt: new Date('2026-06-20T10:00:00.000Z'),
                user: { name: 'Nguyen Van A' },
                payments: [{ method: 'CASH' }],
            },
        ]);
        prismaService.client.order.count.mockResolvedValueOnce(1);

        const result = await service.getRestaurantRevenueDetails(
            101,
            99,
            ['BUSINESS'],
            { limit: 10, offset: 0 },
        );

        expect(result).toEqual({
            success: true,
            data: [
                {
                    orderId: 'ORD-10023',
                    totalAmount: 250000,
                    platformCommission: 25000,
                    restaurantNetRevenue: 225000,
                    completedAt: new Date('2026-06-20T10:00:00.000Z'),
                    paymentMethod: 'CASH',
                    customerName: 'Nguyen Van A',
                },
            ],
            total: 1,
            limit: 10,
            offset: 0,
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'VIEW_RESTAURANT_REVENUE_DETAILS',
            'Restaurant',
            101,
            99,
            { filters: { limit: 10, offset: 0 } },
        );
    });

    it('should update restaurant open status', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 99,
        });
        prismaService.client.restaurant.update.mockResolvedValueOnce({
            id: 101,
            isOpen: false,
        });

        await expect(
            service.updateRestaurantStatus(101, 99, ['BUSINESS'], false),
        ).resolves.toEqual({ id: 101, isOpen: false });

        expect(auditService.log).toHaveBeenCalledWith(
            'UPDATE_RESTAURANT_STATUS',
            'Restaurant',
            101,
            99,
            { isOpen: false },
        );
    });
});

describe('RestaurantService - replyToRestaurantRating', () => {
    let service: RestaurantService;
    let prismaService: any;
    let auditService: { log: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                restaurant: {
                    findFirst: jest.fn(),
                },
                restaurantRating: {
                    findFirst: jest.fn(),
                    update: jest.fn(),
                },
            },
        };
        auditService = {
            log: jest.fn(),
        };

        service = new RestaurantService(
            prismaService,
            auditService as any,
            {} as any,
            {} as any,
        );
    });

    it('should reply to a review when actor owns the restaurant', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce({
            id: 12,
            restaurantId: 101,
        });
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            id: 101,
            ownerId: 99,
        });
        prismaService.client.restaurantRating.update.mockResolvedValueOnce({
            id: 12,
            reply: 'Thanks for your review',
            replyCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
        });

        const result = await service.replyToRestaurantRating(
            12,
            99,
            ['BUSINESS'],
            'Thanks for your review',
        );

        expect(prismaService.client.restaurantRating.update).toHaveBeenCalledWith({
            where: { id: 12 },
            data: {
                reply: 'Thanks for your review',
                replyCreatedAt: expect.any(Date),
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'REPLY_RESTAURANT_REVIEW',
            'RestaurantRating',
            12,
            99,
            { reply: 'Thanks for your review' },
        );
        expect(result.reply).toBe('Thanks for your review');
    });

    it('should throw NotFoundException when replying to a missing review', async () => {
        prismaService.client.restaurantRating.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.replyToRestaurantRating(12, 99, ['BUSINESS'], 'Thanks'),
        ).rejects.toThrow(NotFoundException);
    });
});
