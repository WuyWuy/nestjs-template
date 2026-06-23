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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AddressService } from './address.service';

describe('AddressService', () => {
    let service: AddressService;
    let prismaService: any;
    let auditService: { log: jest.Mock };

    const address = {
        id: 10,
        title: 'Home',
        latitude: 10.776889,
        longitude: 106.700806,
        fullText: '123 Nguyen Hue',
    };

    beforeEach(() => {
        prismaService = {
            client: {
                address: {
                    findFirst: jest.fn(),
                    findMany: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                    delete: jest.fn(),
                },
                restaurant: {
                    findMany: jest.fn(),
                    count: jest.fn(),
                },
                order: {
                    findMany: jest.fn(),
                    count: jest.fn(),
                },
                userAddress: {
                    findMany: jest.fn(),
                    count: jest.fn(),
                },
            },
        };
        auditService = {
            log: jest.fn(),
        };

        service = new AddressService(prismaService, auditService as any);
    });

    it('should return an existing address instead of creating a duplicate', async () => {
        prismaService.client.address.findFirst.mockResolvedValueOnce(address);

        const result = await service.createAddress({
            title: 'Home',
            latitude: 10.776889,
            longitude: 106.700806,
            fullText: '123 Nguyen Hue',
        });

        expect(result).toEqual(address);
        expect(prismaService.client.address.findFirst).toHaveBeenCalledWith({
            where: {
                title: {
                    equals: 'Home',
                    mode: 'insensitive',
                },
                latitude: {
                    gte: 10.776889 - 0.000001,
                    lte: 10.77689,
                },
                longitude: {
                    gte: 106.700806 - 0.000001,
                    lte: 106.700806 + 0.000001,
                },
                fullText: {
                    equals: '123 Nguyen Hue',
                    mode: 'insensitive',
                },
            },
        });
        expect(prismaService.client.address.create).not.toHaveBeenCalled();
    });

    it('should create a new address when no duplicate exists', async () => {
        const input = {
            title: 'Office',
            latitude: 10.786749,
            longitude: 106.690529,
            fullText: '45 Vo Van Tan',
        };
        prismaService.client.address.findFirst.mockResolvedValueOnce(null);
        prismaService.client.address.create.mockResolvedValueOnce({
            id: 11,
            ...input,
        });

        const result = await service.createAddress(input);

        expect(prismaService.client.address.create).toHaveBeenCalledWith({
            data: input,
        });
        expect(result).toEqual({
            id: 11,
            ...input,
        });
    });

    it('should list addresses with keyword filtering and pagination', async () => {
        prismaService.client.address.findMany.mockResolvedValueOnce([address]);

        const result = await service.getAllAddresses({
            keyword: 'nguyen',
            limit: 5,
            offset: 10,
        });

        expect(prismaService.client.address.findMany).toHaveBeenCalledWith({
            where: {
                OR: [
                    {
                        title: {
                            contains: 'nguyen',
                            mode: 'insensitive',
                        },
                    },
                    {
                        fullText: {
                            contains: 'nguyen',
                            mode: 'insensitive',
                        },
                    },
                ],
            },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: 5,
            skip: 10,
        });
        expect(result).toEqual([address]);
    });

    it('should reject address searches with only one coordinate', async () => {
        await expect(
            service.findAddresses({ latitude: 10.776889 }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should search addresses with text and coordinate filters', async () => {
        prismaService.client.address.findMany.mockResolvedValueOnce([address]);

        const result = await service.findAddresses({
            keyword: 'home',
            title: 'Home',
            fullText: 'Nguyen',
            latitude: 10.776889,
            longitude: 106.700806,
            limit: 3,
            offset: 6,
        });

        expect(prismaService.client.address.findMany).toHaveBeenCalledWith({
            where: {
                AND: [
                    {
                        OR: [
                            {
                                title: {
                                    contains: 'home',
                                    mode: 'insensitive',
                                },
                            },
                            {
                                fullText: {
                                    contains: 'home',
                                    mode: 'insensitive',
                                },
                            },
                        ],
                    },
                    {
                        title: {
                            contains: 'Home',
                            mode: 'insensitive',
                        },
                    },
                    {
                        fullText: {
                            contains: 'Nguyen',
                            mode: 'insensitive',
                        },
                    },
                    {
                        latitude: {
                            gte: 10.776889 - 0.000001,
                            lte: 10.776889 + 0.000001,
                        },
                        longitude: {
                            gte: 106.700806 - 0.000001,
                            lte: 106.700806 + 0.000001,
                        },
                    },
                ],
            },
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: 3,
            skip: 6,
        });
        expect(result).toEqual([address]);
    });

    it('should throw NotFoundException when address detail does not exist', async () => {
        prismaService.client.address.findFirst.mockResolvedValueOnce(null);

        await expect(service.getAddressDetail(404)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should return address detail with usage counts and related records', async () => {
        const restaurants = [{ id: 1, name: 'Pizza Shop' }];
        const orders = [{ id: 2, status: 'PENDING' }];
        const userAddresses = [{ id: 3, title: 'Home' }];
        prismaService.client.address.findFirst.mockResolvedValueOnce(address);
        prismaService.client.restaurant.findMany.mockResolvedValueOnce(restaurants);
        prismaService.client.order.findMany.mockResolvedValueOnce(orders);
        prismaService.client.userAddress.findMany.mockResolvedValueOnce(userAddresses);
        prismaService.client.restaurant.count.mockResolvedValueOnce(4);
        prismaService.client.order.count.mockResolvedValueOnce(5);
        prismaService.client.userAddress.count.mockResolvedValueOnce(6);

        const result = await service.getAddressDetail(10);

        expect(result).toEqual({
            ...address,
            usage: {
                restaurantCount: 4,
                orderCount: 5,
                userAddressCount: 6,
            },
            restaurants,
            orders,
            userAddresses,
        });
        expect(prismaService.client.restaurant.findMany).toHaveBeenCalledWith({
            where: {
                addressId: 10,
            },
            select: {
                id: true,
                name: true,
                approved: true,
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                id: 'desc',
            },
            take: 10,
        });
    });

    it('should throw NotFoundException when updating a missing address', async () => {
        prismaService.client.address.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.updateAddress(1, 404, { title: 'Office' }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should reject an empty address update', async () => {
        prismaService.client.address.findFirst.mockResolvedValueOnce(address);

        await expect(service.updateAddress(1, 10, {})).rejects.toThrow(
            BadRequestException,
        );
    });

    it('should reject an address update that duplicates another address', async () => {
        prismaService.client.address.findFirst
            .mockResolvedValueOnce(address)
            .mockResolvedValueOnce({ id: 99 });

        await expect(
            service.updateAddress(1, 10, { title: 'Office' }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should update an address and write an audit log', async () => {
        const updatedAddress = {
            ...address,
            title: 'Office',
        };
        prismaService.client.address.findFirst
            .mockResolvedValueOnce(address)
            .mockResolvedValueOnce(null);
        prismaService.client.address.update.mockResolvedValueOnce(updatedAddress);
        auditService.log.mockResolvedValueOnce(undefined);

        const result = await service.updateAddress(7, 10, { title: 'Office' });

        expect(prismaService.client.address.update).toHaveBeenCalledWith({
            where: {
                id: 10,
            },
            data: {
                title: 'Office',
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'ADMIN_UPDATE_ADDRESS',
            'Address',
            10,
            7,
            {
                before: address,
                after: updatedAddress,
            },
        );
        expect(result).toEqual(updatedAddress);
    });

    it('should throw NotFoundException when deleting a missing address', async () => {
        prismaService.client.address.findFirst.mockResolvedValueOnce(null);

        await expect(service.deleteAddress(1, 404)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should reject deleting an address that is still in use', async () => {
        prismaService.client.address.findFirst.mockResolvedValueOnce(address);
        prismaService.client.restaurant.count.mockResolvedValueOnce(1);
        prismaService.client.order.count.mockResolvedValueOnce(0);
        prismaService.client.userAddress.count.mockResolvedValueOnce(0);

        await expect(service.deleteAddress(1, 10)).rejects.toThrow(
            BadRequestException,
        );
        expect(prismaService.client.address.delete).not.toHaveBeenCalled();
    });

    it('should delete an unused address and write an audit log', async () => {
        prismaService.client.address.findFirst.mockResolvedValueOnce(address);
        prismaService.client.restaurant.count.mockResolvedValueOnce(0);
        prismaService.client.order.count.mockResolvedValueOnce(0);
        prismaService.client.userAddress.count.mockResolvedValueOnce(0);
        prismaService.client.address.delete.mockResolvedValueOnce(address);
        auditService.log.mockResolvedValueOnce(undefined);

        const result = await service.deleteAddress(7, 10);

        expect(prismaService.client.address.delete).toHaveBeenCalledWith({
            id: 10,
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'ADMIN_DELETE_ADDRESS',
            'Address',
            10,
            7,
            address,
        );
        expect(result).toEqual({
            message: 'Address deleted successfully',
            id: 10,
        });
    });
});
