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
    OrderStatus: {
        PENDING: 'PENDING',
        CONFIRMED: 'CONFIRMED',
        PREPARING: 'PREPARING',
        DELIVERING: 'DELIVERING',
        DELIVERED: 'DELIVERED',
        CANCELLED: 'CANCELLED',
    },
    NotificationType: {
        SYSTEM: 'SYSTEM',
        ORDER: 'ORDER',
        PAYMENT: 'PAYMENT',
        PROMOTION: 'PROMOTION',
        CHAT: 'CHAT',
    },
    PaymentStatus: {
        UNPAID: 'UNPAID',
        DONE: 'DONE',
    },
    VoucherStatus: {
        APPLYING: 'APPLYING',
        ENDED: 'ENDED',
    },
}));

import { RestaurantService } from './restaurant.service';

describe('RestaurantService - generated dashboard', () => {
    it('returns summary, recent orders, best sellers and active vouchers', async () => {
        const prismaService = {
            client: {
                restaurant: {
                    findFirst: jest.fn().mockResolvedValue({
                        id: 101,
                        ownerId: 99,
                    }),
                },
                order: {
                    groupBy: jest.fn().mockResolvedValue([
                        {
                            status: 'PENDING',
                            _count: { id: 5 },
                            _sum: { totalPrice: 50 },
                        },
                        {
                            status: 'PREPARING',
                            _count: { id: 12 },
                            _sum: { totalPrice: 120 },
                        },
                        {
                            status: 'DELIVERING',
                            _count: { id: 8 },
                            _sum: { totalPrice: 80 },
                        },
                        {
                            status: 'DELIVERED',
                            _count: { id: 3 },
                            _sum: { totalPrice: 60 },
                        },
                        {
                            status: 'CONFIRMED',
                            _count: { id: 117 },
                            _sum: { totalPrice: '2241.00' },
                        },
                    ]),
                    aggregate: jest.fn().mockResolvedValue({
                        _sum: { totalPrice: '2241.00' },
                    }),
                },
                payment: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            createdAt: new Date('2026-06-24T03:30:00.000Z'),
                            order: {
                                id: 9842,
                                totalPrice: '24.50',
                                status: 'DELIVERED',
                                user: { name: 'Nguyen Van A' },
                            },
                        },
                    ]),
                },
                orderFood: {
                    groupBy: jest.fn().mockResolvedValue([
                        { foodId: 2, _sum: { quantity: 200 } },
                        { foodId: 1, _sum: { quantity: 120 } },
                    ]),
                },
                food: {
                    findMany: jest.fn().mockResolvedValue([
                        {
                            id: 1,
                            name: 'Burger Classic',
                            price: '5.99',
                            image: 'https://example.com/burger.jpg',
                            rating: 4,
                            ratings: [{ vote: 4 }, { vote: 5 }],
                        },
                        {
                            id: 2,
                            name: 'Pizza Seafood',
                            price: '8.99',
                            image: 'https://example.com/pizza.jpg',
                            rating: 5,
                            ratings: [{ vote: 5 }, { vote: 4 }, { vote: 5 }],
                        },
                    ]),
                },
                restaurantRating: {
                    aggregate: jest.fn().mockResolvedValue({
                        _avg: { vote: 4.88 },
                        _count: { id: 25 },
                    }),
                },
                voucher: {
                    count: jest.fn().mockResolvedValue(3),
                },
            },
        };
        const service = new RestaurantService(
            prismaService as any,
            {} as any,
            {} as any,
            {} as any,
        );

        await expect(
            service.generateRestaurantDashboard(101, 99, ['BUSINESS']),
        ).resolves.toEqual({
            runningOrders: 23,
            orderRequest: 5,
            revenue: 2241,
            rating: 4.9,
            totalReviews: 25,
            totalOrders: 145,
            activeVouchers: 3,
            recentOrders: [
                {
                    id: '9842',
                    orderNumber: '9842',
                    customerName: 'Nguyen Van A',
                    totalPrice: 24.5,
                    status: 'Delivered',
                    time: '10:30 AM',
                },
            ],
            bestSellers: [
                {
                    id: 2,
                    name: 'Pizza Seafood',
                    price: 8.99,
                    rating: 4.7,
                    soldCount: 200,
                    imageUrl: 'https://example.com/pizza.jpg',
                },
                {
                    id: 1,
                    name: 'Burger Classic',
                    price: 5.99,
                    rating: 4.5,
                    soldCount: 120,
                    imageUrl: 'https://example.com/burger.jpg',
                },
            ],
        });
    });

    it('returns zero values and empty lists when the restaurant has no activity', async () => {
        const foodFindMany = jest.fn();
        const prismaService = {
            client: {
                restaurant: {
                    findFirst: jest.fn().mockResolvedValue({
                        id: 101,
                        ownerId: 99,
                    }),
                },
                order: {
                    groupBy: jest.fn().mockResolvedValue([]),
                    aggregate: jest.fn().mockResolvedValue({
                        _sum: { totalPrice: null },
                    }),
                },
                payment: {
                    findMany: jest.fn().mockResolvedValue([]),
                },
                orderFood: {
                    groupBy: jest.fn().mockResolvedValue([]),
                },
                food: {
                    findMany: foodFindMany,
                },
                restaurantRating: {
                    aggregate: jest.fn().mockResolvedValue({
                        _avg: { vote: null },
                        _count: { id: 0 },
                    }),
                },
                voucher: {
                    count: jest.fn().mockResolvedValue(0),
                },
            },
        };
        const service = new RestaurantService(
            prismaService as any,
            {} as any,
            {} as any,
            {} as any,
        );

        await expect(
            service.generateRestaurantDashboard(101, 99, ['BUSINESS']),
        ).resolves.toEqual({
            runningOrders: 0,
            orderRequest: 0,
            revenue: 0,
            rating: 0,
            totalReviews: 0,
            totalOrders: 0,
            activeVouchers: 0,
            recentOrders: [],
            bestSellers: [],
        });
        expect(foodFindMany).not.toHaveBeenCalled();
    });
});
