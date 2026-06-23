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
    VoucherStatus: {
        APPLYING: 'APPLYING',
        ENDED: 'ENDED',
    },
    VoucherType: {
        MONEY: 'MONEY',
        PERCENT: 'PERCENT',
    },
    NotificationType: {
        PROMOTION: 'PROMOTION',
    },
}));

import {
    BadRequestException,
    ForbiddenException,
    NotFoundException,
} from '@nestjs/common';
import { VoucherService } from './voucher.service';

describe('VoucherService', () => {
    let service: VoucherService;
    let prismaService: any;
    let auditService: { log: jest.Mock };
    let minioService: { uploadFile: jest.Mock };
    let eventEmitter: { emit: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                voucher: {
                    findMany: jest.fn(),
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                },
                restaurant: {
                    findFirst: jest.fn(),
                    findUnique: jest.fn(),
                },
                user: {
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
        eventEmitter = {
            emit: jest.fn(),
        };

        service = new VoucherService(
            prismaService,
            auditService as any,
            minioService as any,
            eventEmitter as any,
        );
    });

    it('should list vouchers with filters, pagination and numeric money fields', async () => {
        prismaService.client.voucher.findMany.mockResolvedValueOnce([
            {
                id: 1,
                name: 'Welcome',
                code: 'WELCOME10',
                minimumOrderAmount: '20.50',
                maximumDiscountAmount: '5.25',
            },
        ]);

        const result = await service.getVouchers({
            restaurantId: 101,
            status: 'APPLYING' as any,
            code: 'wel',
            limit: 5,
            offset: 10,
        });

        expect(prismaService.client.voucher.findMany).toHaveBeenCalledWith({
            where: {
                restaurantId: 101,
                status: 'APPLYING',
                code: {
                    contains: 'wel',
                    mode: 'insensitive',
                },
                OR: undefined,
            },
            select: expect.objectContaining({
                id: true,
                name: true,
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            }),
            orderBy: {
                createdAt: 'desc',
            },
            take: 5,
            skip: 10,
        });
        expect(result).toEqual([
            expect.objectContaining({
                id: 1,
                minimumOrderAmount: 20.5,
                maximumDiscountAmount: 5.25,
            }),
        ]);
    });

    it('should list active vouchers by startAt when status filter is omitted', async () => {
        prismaService.client.voucher.findMany.mockResolvedValueOnce([]);

        await service.getVouchers({});

        expect(prismaService.client.voucher.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    status: undefined,
                    OR: [
                        {
                            startAt: null,
                        },
                        {
                            startAt: {
                                lte: expect.any(Date),
                            },
                        },
                    ],
                }),
                take: 20,
                skip: 0,
            }),
        );
    });

    it('should return voucher detail with converted money fields', async () => {
        prismaService.client.voucher.findFirst.mockResolvedValueOnce({
            id: 1,
            code: 'WELCOME10',
            minimumOrderAmount: '10',
            maximumDiscountAmount: null,
            restaurant: { id: 101, name: 'Burger Town' },
        });

        const result = await service.getVoucherDetail(1);

        expect(prismaService.client.voucher.findFirst).toHaveBeenCalledWith({
            where: {
                id: 1,
            },
            include: {
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
        expect(result).toEqual({
            id: 1,
            code: 'WELCOME10',
            minimumOrderAmount: 10,
            maximumDiscountAmount: null,
            restaurant: { id: 101, name: 'Burger Town' },
        });
    });

    it('should throw NotFoundException when voucher detail is missing', async () => {
        prismaService.client.voucher.findFirst.mockResolvedValueOnce(null);

        await expect(service.getVoucherDetail(404)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should find a voucher by code case-insensitively and optional restaurant id', async () => {
        prismaService.client.voucher.findFirst.mockResolvedValueOnce({
            id: 1,
            code: 'WELCOME10',
            minimumOrderAmount: '0',
            maximumDiscountAmount: '10',
        });

        const result = await service.getVoucherByCode('welcome10', 101);

        expect(prismaService.client.voucher.findFirst).toHaveBeenCalledWith({
            where: {
                code: {
                    equals: 'welcome10',
                    mode: 'insensitive',
                },
                restaurantId: 101,
            },
        });
        expect(result).toEqual(
            expect.objectContaining({
                minimumOrderAmount: 0,
                maximumDiscountAmount: 10,
            }),
        );
    });

    it('should reject duplicate voucher codes in the same restaurant scope', async () => {
        prismaService.client.voucher.findFirst.mockResolvedValueOnce({ id: 1 });

        await expect(
            service.createVoucher(99, ['ADMIN'], {
                name: 'Welcome',
                code: 'WELCOME10',
                sale: 10,
                type: 'PERCENT' as any,
                restaurantId: 101,
            }),
        ).rejects.toThrow(BadRequestException);
        expect(prismaService.client.voucher.create).not.toHaveBeenCalled();
    });

    it('should create an applying voucher with uploaded image, audit log and promotion notifications', async () => {
        const file = { originalname: 'voucher.jpg' } as any;
        const data = {
            name: 'Welcome',
            code: 'WELCOME10',
            description: 'Ten percent off',
            sale: 10,
            type: 'PERCENT' as any,
            restaurantId: 101,
            minimumOrderAmount: 20,
            maximumDiscountAmount: 5,
            startAt: '2026-06-01T00:00:00.000Z',
            endAt: '2026-07-01T00:00:00.000Z',
        };
        prismaService.client.voucher.findFirst.mockResolvedValueOnce(null);
        minioService.uploadFile.mockResolvedValueOnce(
            'https://cdn.example.com/voucher.jpg',
        );
        prismaService.client.voucher.create.mockResolvedValueOnce({
            id: 1,
            ...data,
            image: 'https://cdn.example.com/voucher.jpg',
            status: 'APPLYING',
        });
        prismaService.client.restaurant.findUnique.mockResolvedValueOnce({
            name: 'Burger Town',
        });
        prismaService.client.user.findMany.mockResolvedValueOnce([
            { id: 201 },
            { id: 202 },
        ]);

        const result = await service.createVoucher(99, ['ADMIN'], data, file);

        expect(minioService.uploadFile).toHaveBeenCalledWith(file);
        expect(prismaService.client.voucher.create).toHaveBeenCalledWith({
            data: {
                name: 'Welcome',
                code: 'WELCOME10',
                description: 'Ten percent off',
                image: 'https://cdn.example.com/voucher.jpg',
                sale: 10,
                type: 'PERCENT',
                status: 'APPLYING',
                restaurantId: 101,
                minimumOrderAmount: 20,
                maximumDiscountAmount: 5,
                startAt: new Date('2026-06-01T00:00:00.000Z'),
                endAt: new Date('2026-07-01T00:00:00.000Z'),
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'CREATE_VOUCHER',
            'Voucher',
            1,
            99,
            data,
        );
        expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
        expect(eventEmitter.emit).toHaveBeenCalledWith(
            'notification.send',
            expect.objectContaining({
                recipientUserId: 201,
                title: 'New Promotion Available!',
                type: 'PROMOTION',
                targetType: 'VOUCHER',
                targetId: 1,
                actorId: 99,
                metadata: {
                    voucherId: 1,
                    code: 'WELCOME10',
                },
            }),
        );
        expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    it('should allow a business owner to create a restaurant-scoped voucher', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            ownerId: 99,
        });
        prismaService.client.voucher.findFirst.mockResolvedValueOnce(null);
        prismaService.client.voucher.create.mockResolvedValueOnce({
            id: 1,
            code: 'OWNER10',
            status: 'ENDED',
            restaurantId: 101,
        });

        await service.createVoucher(99, ['BUSINESS'], {
            name: 'Owner voucher',
            code: 'OWNER10',
            sale: 10,
            type: 'PERCENT' as any,
            status: 'ENDED' as any,
            restaurantId: 101,
        });

        expect(prismaService.client.restaurant.findFirst).toHaveBeenCalledWith({
            where: {
                id: 101,
            },
            select: {
                ownerId: true,
            },
        });
    });

    it('should reject business users creating global vouchers', async () => {
        await expect(
            service.createVoucher(99, ['BUSINESS'], {
                name: 'Global',
                code: 'GLOBAL10',
                sale: 10,
                type: 'PERCENT' as any,
            }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should reject business users managing another restaurant voucher scope', async () => {
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            ownerId: 88,
        });

        await expect(
            service.createVoucher(99, ['BUSINESS'], {
                name: 'Other owner',
                code: 'OTHER10',
                sale: 10,
                type: 'PERCENT' as any,
                restaurantId: 101,
            }),
        ).rejects.toThrow(ForbiddenException);
    });

    it('should update an existing voucher and write audit log', async () => {
        const file = { originalname: 'updated.jpg' } as any;
        const data = {
            name: 'Updated',
            startAt: '2026-08-01T00:00:00.000Z',
        };
        prismaService.client.voucher.findFirst.mockResolvedValueOnce({
            id: 1,
            restaurantId: null,
        });
        minioService.uploadFile.mockResolvedValueOnce(
            'https://cdn.example.com/updated.jpg',
        );
        prismaService.client.voucher.update.mockResolvedValueOnce({
            id: 1,
            name: 'Updated',
        });

        const result = await service.updateVoucher(99, ['ADMIN'], 1, data, file);

        expect(prismaService.client.voucher.update).toHaveBeenCalledWith({
            where: {
                id: 1,
            },
            data: {
                name: 'Updated',
                startAt: new Date('2026-08-01T00:00:00.000Z'),
                image: 'https://cdn.example.com/updated.jpg',
                endAt: undefined,
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'UPDATE_VOUCHER',
            'Voucher',
            1,
            99,
            data,
        );
        expect(result).toEqual({ id: 1, name: 'Updated' });
    });

    it('should throw NotFoundException when updating a missing voucher', async () => {
        prismaService.client.voucher.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.updateVoucher(99, ['ADMIN'], 404, { name: 'Missing' }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should end an owned voucher and write audit log', async () => {
        prismaService.client.voucher.findFirst.mockResolvedValueOnce({
            id: 1,
            restaurantId: 101,
        });
        prismaService.client.restaurant.findFirst.mockResolvedValueOnce({
            ownerId: 99,
        });
        prismaService.client.voucher.update.mockResolvedValueOnce({
            id: 1,
            status: 'ENDED',
        });

        const result = await service.endVoucher(99, ['BUSINESS'], 1);

        expect(prismaService.client.voucher.update).toHaveBeenCalledWith({
            where: {
                id: 1,
            },
            data: {
                status: 'ENDED',
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'END_VOUCHER',
            'Voucher',
            1,
            99,
        );
        expect(result).toEqual({ id: 1, status: 'ENDED' });
    });
});
