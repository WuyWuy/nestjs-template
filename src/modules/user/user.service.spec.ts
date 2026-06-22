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
