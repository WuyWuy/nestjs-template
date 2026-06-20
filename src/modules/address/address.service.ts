import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
    CustomPrismaClient,
    TransactionClientExtended,
} from '@/prisma/custom-prisma-client';
import { PrismaService } from '@/prisma/prisma.service';
import {
    AddressListQueryDto,
    CreateAddressDto,
    FindAddressDto,
    UpdateAddressDto,
} from './dto/address.dto';
import { AuditService } from '../audit/audit.service';

type AddressDb = CustomPrismaClient | TransactionClientExtended;

@Injectable()
export class AddressService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly auditService: AuditService,
    ) {}

    private readonly locationTolerance = 0.000001;

    private getAddressDb(db?: AddressDb) {
        return db ?? this.prismaService.client;
    }

    private buildLocationFilter(latitude: number, longitude: number) {
        return {
            latitude: {
                gte: latitude - this.locationTolerance,
                lte: latitude + this.locationTolerance,
            },
            longitude: {
                gte: longitude - this.locationTolerance,
                lte: longitude + this.locationTolerance,
            },
        };
    }

    async findAddress(address: CreateAddressDto, db?: AddressDb) {
        const addressDb = this.getAddressDb(db);

        return await addressDb.address.findFirst({
            where: {
                title: {
                    equals: address.title,
                    mode: 'insensitive',
                },
                ...this.buildLocationFilter(address.latitude, address.longitude),
                fullText: address.fullText
                    ? {
                          equals: address.fullText,
                          mode: 'insensitive',
                      }
                    : undefined,
            },
        });
    }

    async createAddress(address: CreateAddressDto, db?: AddressDb) {
        try {
            const addressDb = this.getAddressDb(db);
            const existsAddress = await this.findAddress(address, addressDb);
            if (existsAddress) return existsAddress;

            return await addressDb.address.create({
                data: {
                    ...address,
                },
            });
        } catch (err) {
            console.log('creating address error:', err);
            throw err;
        }
    }

    async getAllAddresses(query: AddressListQueryDto) {
        return await this.prismaService.client.address.findMany({
            where: query.keyword
                ? {
                      OR: [
                          {
                              title: {
                                  contains: query.keyword,
                                  mode: 'insensitive',
                              },
                          },
                          {
                              fullText: {
                                  contains: query.keyword,
                                  mode: 'insensitive',
                              },
                          },
                      ],
                  }
                : undefined,
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: query.limit ?? 20,
            skip: query.offset ?? 0,
        });
    }

    async getAddressDetail(id: number) {
        const address = await this.prismaService.client.address.findFirst({
            where: {
                id,
            },
        });

        if (!address) {
            throw new NotFoundException('Address not found');
        }

        const [restaurants, orders, userAddresses] = await Promise.all([
            this.prismaService.client.restaurant.findMany({
                where: {
                    addressId: id,
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
            }),
            this.prismaService.client.order.findMany({
                where: {
                    addressId: id,
                },
                select: {
                    id: true,
                    status: true,
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                    restaurant: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    id: 'desc',
                },
                take: 10,
            }),
            this.prismaService.client.userAddress.findMany({
                where: {
                    addressId: id,
                    deleteAt: null,
                },
                select: {
                    id: true,
                    title: true,
                    user: {
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
            }),
        ]);

        const [restaurantCount, orderCount, userAddressCount] = await Promise.all(
            [
                this.prismaService.client.restaurant.count({
                    where: {
                        addressId: id,
                        deleteAt: null,
                    },
                }),
                this.prismaService.client.order.count({
                    where: {
                        addressId: id,
                        deleteAt: null,
                    },
                }),
                this.prismaService.client.userAddress.count({
                    where: {
                        addressId: id,
                        deleteAt: null,
                    },
                }),
            ],
        );

        return {
            ...address,
            usage: {
                restaurantCount,
                orderCount,
                userAddressCount,
            },
            restaurants,
            orders,
            userAddresses,
        };
    }

    async findAddresses(query: FindAddressDto) {
        const hasLatitude = query.latitude !== undefined;
        const hasLongitude = query.longitude !== undefined;

        if (hasLatitude !== hasLongitude) {
            throw new BadRequestException(
                'latitude and longitude must be provided together',
            );
        }

        const andConditions: Prisma.AddressWhereInput[] = [];

        if (query.keyword) {
            andConditions.push({
                OR: [
                    {
                        title: {
                            contains: query.keyword,
                            mode: 'insensitive',
                        },
                    },
                    {
                        fullText: {
                            contains: query.keyword,
                            mode: 'insensitive',
                        },
                    },
                ],
            });
        }

        if (query.title) {
            andConditions.push({
                title: {
                    contains: query.title,
                    mode: 'insensitive',
                },
            });
        }

        if (query.fullText) {
            andConditions.push({
                fullText: {
                    contains: query.fullText,
                    mode: 'insensitive',
                },
            });
        }

        if (hasLatitude && hasLongitude) {
            andConditions.push(
                this.buildLocationFilter(
                    query.latitude as number,
                    query.longitude as number,
                ),
            );
        }

        return await this.prismaService.client.address.findMany({
            where: andConditions.length
                ? {
                      AND: andConditions,
                  }
                : undefined,
            orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
            take: query.limit ?? 20,
            skip: query.offset ?? 0,
        });
    }

    async updateAddress(actorId: number, id: number, data: UpdateAddressDto) {
        const address = await this.prismaService.client.address.findFirst({
            where: {
                id,
            },
        });

        if (!address) {
            throw new NotFoundException('Address not found');
        }

        if (!Object.keys(data).length) {
            throw new BadRequestException(
                'No valid address data provided for update',
            );
        }

        const mergedAddress = {
            title: data.title ?? address.title,
            latitude: data.latitude ?? address.latitude,
            longitude: data.longitude ?? address.longitude,
            fullText: data.fullText ?? address.fullText ?? undefined,
        };

        if (
            mergedAddress.latitude !== null &&
            mergedAddress.latitude !== undefined &&
            mergedAddress.longitude !== null &&
            mergedAddress.longitude !== undefined
        ) {
            const duplicatedAddress = await this.findAddress({
                title: mergedAddress.title,
                latitude: mergedAddress.latitude,
                longitude: mergedAddress.longitude,
                fullText: mergedAddress.fullText,
            });

            if (duplicatedAddress && duplicatedAddress.id !== id) {
                throw new BadRequestException(
                    'Another address with the same information already exists',
                );
            }
        }

        const updatedAddress = await this.prismaService.client.address.update({
            where: {
                id,
            },
            data,
        });

        await this.auditService.log(
            'ADMIN_UPDATE_ADDRESS',
            'Address',
            id,
            actorId,
            {
                before: address,
                after: updatedAddress,
            },
        );

        return updatedAddress;
    }

    async deleteAddress(actorId: number, id: number) {
        const address = await this.prismaService.client.address.findFirst({
            where: {
                id,
            },
        });

        if (!address) {
            throw new NotFoundException('Address not found');
        }

        const [restaurantCount, orderCount, userAddressCount] = await Promise.all(
            [
                this.prismaService.client.restaurant.count({
                    where: {
                        addressId: id,
                        deleteAt: null,
                    },
                }),
                this.prismaService.client.order.count({
                    where: {
                        addressId: id,
                        deleteAt: null,
                    },
                }),
                this.prismaService.client.userAddress.count({
                    where: {
                        addressId: id,
                        deleteAt: null,
                    },
                }),
            ],
        );

        if (restaurantCount || orderCount || userAddressCount) {
            throw new BadRequestException(
                'Address is still being used and cannot be deleted',
            );
        }

        await this.prismaService.client.address.delete({ id });

        await this.auditService.log(
            'ADMIN_DELETE_ADDRESS',
            'Address',
            id,
            actorId,
            address,
        );

        return {
            message: 'Address deleted successfully',
            id,
        };
    }
}
