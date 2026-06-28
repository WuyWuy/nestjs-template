import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { MinioService } from '../minio/minio.service';
import { Express } from 'express';
import {
    AddUserAddressDto,
    UpdateUserAddressDto,
    UpdateUserProfileDto,
} from './dto/user.dto';
import { AddressService } from '../address/address.service';
import { ChangeUserAddressLocationDto } from '../address/dto/address.dto';
import { buildUserAddressLocationPayload } from '../address/user-address-location.helper';
import { TransactionClientExtended } from '@/prisma/custom-prisma-client';
import type { CustomPrismaClient } from '@/prisma/custom-prisma-client';

const userAddressSelect = {
    id: true,
    title: true,
    addressDetail: true,
    address: true,
} as const;
@Injectable()
export class UserService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly minioService: MinioService,
        private readonly addressService: AddressService,
    ) {}
    //__________________________HELPER
    async findById(userId: number) {
        const user = await this.prismaService.client.user.findFirst({
            where: {
                id: userId,
            },
            include: {
                cart: true,
            },
        });
        return user;
    }
    async uploadImages(file: Express.Multer.File) {
        try {
            if (!file) throw new BadRequestException('File is required');
            const results = await this.minioService.uploadFile(file);
            console.log('File name: ', results);
            return results;
        } catch (err) {
            console.log('upload file error', err);
            throw err;
        }
    }
    async getAllUsers() {
        try {
            const customers = await this.prismaService.client.user.findMany({
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
            return customers;
        } catch (err) {
            console.log('Get customer error', err);
            throw err;
        }
    }
    //Xem lại giao diện như thế nào sau đó mới xử lí logic tương đương
    async deleteCustomerAccount(id: number) {
        try {
            const result = await this.prismaService.transaction(async (tx) => {
                const response = await tx.user.update({
                    where: {
                        id,
                    },
                    data: {
                        deleteAt: new Date(Date.now()),
                    },
                });
                return response;
            });
            return result;
        } catch (err) {
            console.log('Delete customer account', err);
            throw err;
        }
    }
    async getUserProfile(id: number) {
        try {
            const user = await this.getUserById(id);
            if (!user) throw new BadRequestException('customer not found');
            const customer = await this.prismaService.client.user.findFirst({
                where: { id },
                select: {
                    name: true,
                    email: true,
                    phone: true,
                    birthday: true,
                    avatar: true, //Fix lai la lay avatar
                },
            });
            if (!customer) throw new BadRequestException('customer not found');
            const newAvatar = await this.resolveAvatarUrl(customer.avatar);
            return {
                ...customer,
                avatar: newAvatar,
            };
        } catch (err) {
            console.log('get customer error', err);
            throw err;
        }
    }
    async updateUserProfile(
        id: number,
        data: UpdateUserProfileDto,
        file: Express.Multer.File,
    ) {
        try {
            const user = await this.getUserById(id);
            if (!user) throw new BadRequestException('user not found');
            const result = await this.prismaService.transaction(async (tx) => {
                let avatar = user.avatar;
                if (file) {
                    avatar = await this.minioService.uploadFile(file);
                }
                const nuser = await tx.user.update({
                    where: { id },
                    data: {
                        ...data,
                        avatar,
                    },
                });
                return nuser;
            });
            return result;
        } catch (err) {
            console.log('update user profile error', err);
            throw err;
        }
    }
    async getUserById(id: number) {
        const user = await this.prismaService.client.user.findFirst({
            where: {
                id,
            },
        });
        return user;
    }
    private async resolveAvatarUrl(avatar: string) {
        if (!avatar) return '';
        if (/^https?:\/\//i.test(avatar)) return avatar;
        return await this.minioService.getFileUrl(avatar);
    }
    private async getUserAddressResponse(
        id: number,
        userId: number,
        db: TransactionClientExtended | CustomPrismaClient = this
            .prismaService.client,
    ) {
        return await db.userAddress.findFirst({
            where: {
                id, 
                userId,
                deleteAt: null,
            },
            select: userAddressSelect,
        });
    }
    private async getUserAddressOrThrow(id: number, userId: number) {
        const userAddress = await this.prismaService.client.userAddress.findFirst({
            where: {
                id,   //userAddressId 
                userId,
                deleteAt: null,
            },
        });
        if (!userAddress) {
            throw new BadRequestException(
                'This address not belong to this user or was deleted',
            );
        }
        return userAddress;
    }
    async addUserAddress(userId: number, address: AddUserAddressDto) {
        try {
            const user = await this.getUserById(userId);
            if (!user) throw new UnauthorizedException('user not found');
            const result = await this.prismaService.transaction(async (tx) => {
                const crAddress = await this.addressService.createAddress(
                    address.address,
                    tx,
                );
                const respo = await tx.userAddress.create({
                    data: {
                        title: address.title,
                        addressId: crAddress.id,
                        userId: userId,
                        addressDetail: address.addressDetail?.trim() || null,
                    },
                });
                return await this.getUserAddressResponse(respo.id, userId, tx);
            });
            return result;
        } catch (err) {
            console.log('add user address error', err);
            throw err;
        }
    }
    async getAllAddress(userId: number) {
        try {
            const user = await this.getUserById(userId);
            if (!user) throw new UnauthorizedException('user not found');
            const addresses =
                await this.prismaService.client.userAddress.findMany({
                    where: { userId, deleteAt: null },
                    select: userAddressSelect,
                });
            return addresses;
        } catch (err) {
            console.log('get all address error', err);
            throw err;
        }
    }
    async updateUserAddress(
        addressId: number,
        userId: number,
        updateAddress: UpdateUserAddressDto,
    ) {
        try {
            await this.getUserAddressOrThrow(addressId, userId);

            const updateData: Record<string, unknown> = {};

            if (updateAddress.title !== undefined) {
                updateData.title = updateAddress.title;
            }

            if (updateAddress.addressDetail !== undefined) {
                updateData.addressDetail =
                    updateAddress.addressDetail.trim() || null;
            }

            if (!Object.keys(updateData).length) {
                throw new BadRequestException(
                    'No valid address data provided for update',
                );
            }

            await this.prismaService.client.userAddress.update({
                where: {
                    id: addressId,
                    userId,
                },
                data: updateData,
            });

            return await this.getUserAddressResponse(addressId, userId);
        } catch (err) {
            console.log("update user's address", err);
            throw err;
        }
    }

    async updateUserAddressLocation(
        addressId: number,
        userId: number,
        location: ChangeUserAddressLocationDto,
    ) {
        try {
            const userAddress =
                await this.prismaService.client.userAddress.findFirst({
                    where: {
                        id: addressId,
                        userId,
                        deleteAt: null,
                    },
                    include: {
                        address: true,
                    },
                });

            if (!userAddress) {
                throw new BadRequestException(
                    'This address not belong to this user or was deleted',
                );
            }

            const result = await this.prismaService.transaction(async (tx) => {
                const addressRecord = await this.addressService.createAddress(
                    buildUserAddressLocationPayload(location),
                    tx,
                );

                await tx.userAddress.update({
                    where: {
                        id: userAddress.id,
                        userId,
                    },
                    data: {
                        addressId: addressRecord.id,
                    },
                });

                return await this.getUserAddressResponse(
                    userAddress.id,
                    userId,
                    tx,
                );
            });
            return result;
        } catch (err) {
            console.log("update user's address location", err);
            throw err;
        }
    }
    async getUserAddressById(id: number, userId: number) {
        try {
            const result =
                await this.prismaService.client.userAddress.findFirst({
                    where: { id, userId, deleteAt: null },
                    select: userAddressSelect,
                });
            if (!result)
                throw new BadRequestException('User Address not found');
            return result;
        } catch (err) {
            console.log("get user's address by id error", err);
            throw err;
        }
    }
    async deleteUserAddress(id: number, userId: number) {
        try {
            await this.getUserAddressOrThrow(id, userId);
            await this.prismaService.client.userAddress.update({
                where: {
                    id,
                },
                data: {
                    deleteAt: new Date(Date.now()),
                },
            });
            return {
                message: 'User address deleted successfully',
                id,
            };
        } catch (err) {
            console.log("delete user's address error", err);
            throw err;
        }
    }

    async getMyReviews(userId: number, limit: number, offset: number) {
        try {
            const ratings = await this.prismaService.client.restaurantRating.findMany({
                where: {
                    userId,
                    deleteAt: null,
                },
                take: limit,
                skip: offset,
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

            return ratings.map((r) => ({
                id: r.id,
                restaurantId: r.restaurantId,
                restaurantName: r.restaurant.name,
                vote: r.vote,
                comment: r.comment,
                tags: r.tags,
                orderId: r.orderId,
                createdAt: r.createdAt,
                reply: r.reply,
                replyCreatedAt: r.replyCreatedAt,
            }));
        } catch (err) {
            console.log('Get my reviews error', err);
            throw err;
        }
    }
}
