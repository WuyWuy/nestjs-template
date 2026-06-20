import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Role, VoucherStatus, NotificationType } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { Express } from 'express';
import {
    CreateVoucherDto,
    UpdateVoucherDto,
    VoucherListQueryDto,
} from './dto/voucher.dto';
import { MinioService } from '../minio/minio.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEvent } from '../notification/events/notification.event';

@Injectable()
export class VoucherService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly auditService: AuditService,
        private readonly minioService: MinioService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    private hasRole(roles: string[], role: Role) {
        return roles.includes(role);
    }
    private async resolveVoucherImagePayload(
        data: Partial<CreateVoucherDto>,
        file?: Express.Multer.File,
    ) {
        let image = data.image;
        if (file) {
            image = await this.minioService.uploadFile(file);
        }

        return {
            ...data,
            image,
        };
    }

    private async assertVoucherOwner(
        actorId: number,
        roles: string[],
        restaurantId?: number | null,
    ) {
        if (this.hasRole(roles, Role.ADMIN)) {
            return;
        }

        if (!restaurantId) {
            throw new ForbiddenException(
                'Business users can only manage restaurant vouchers',
            );
        }

        const restaurant = await this.prismaService.client.restaurant.findFirst({
            where: {
                id: restaurantId,
            },
            select: {
                ownerId: true,
            },
        });

        if (!restaurant || restaurant.ownerId !== actorId) {
            throw new ForbiddenException(
                'You do not own this restaurant voucher scope',
            );
        }
    }

    async getVouchers(query: VoucherListQueryDto) {
        const now = new Date();
        const vouchers = await this.prismaService.client.voucher.findMany({
            where: {
                restaurantId: query.restaurantId,
                status: query.status,
                code: query.code
                    ? {
                          contains: query.code,
                          mode: 'insensitive',
                      }
                    : undefined,
                OR: query.status
                    ? undefined
                    : [
                          {
                              startAt: null,
                          },
                          {
                              startAt: {
                                  lte: now,
                              },
                          },
                      ],
            },
            select: {
                id: true,
                name: true,
                code: true,
                description: true,
                image: true,
                sale: true,
                type: true,
                status: true,
                minimumOrderAmount: true,
                maximumDiscountAmount: true,
                startAt: true,
                endAt: true,
                restaurant: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: query.limit ?? 20,
            skip: query.offset ?? 0,
        });

        return vouchers.map((voucher) => ({
            ...voucher,
            minimumOrderAmount: Number(voucher.minimumOrderAmount),
            maximumDiscountAmount: voucher.maximumDiscountAmount
                ? Number(voucher.maximumDiscountAmount)
                : null,
        }));
    }

    async getVoucherDetail(id: number) {
        const voucher = await this.prismaService.client.voucher.findFirst({
            where: {
                id,
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

        if (!voucher) {
            throw new NotFoundException('Voucher not found');
        }

        return {
            ...voucher,
            minimumOrderAmount: Number(voucher.minimumOrderAmount),
            maximumDiscountAmount: voucher.maximumDiscountAmount
                ? Number(voucher.maximumDiscountAmount)
                : null,
        };
    }

    async getVoucherByCode(code: string, restaurantId?: number) {
        const voucher = await this.prismaService.client.voucher.findFirst({
            where: {
                code: {
                    equals: code,
                    mode: 'insensitive',
                },
                restaurantId,
            },
        });

        if (!voucher) {
            throw new NotFoundException('Voucher not found');
        }

        return {
            ...voucher,
            minimumOrderAmount: Number(voucher.minimumOrderAmount),
            maximumDiscountAmount: voucher.maximumDiscountAmount
                ? Number(voucher.maximumDiscountAmount)
                : null,
        };
    }

    async createVoucher(
        actorId: number,
        roles: string[],
        data: CreateVoucherDto,
        file?: Express.Multer.File,
    ) {
        await this.assertVoucherOwner(actorId, roles, data.restaurantId);

        const existsVoucher = await this.prismaService.client.voucher.findFirst({
            where: {
                code: {
                    equals: data.code,
                    mode: 'insensitive',
                },
                restaurantId: data.restaurantId ?? null,
            },
        });

        if (existsVoucher) {
            throw new BadRequestException('Voucher code already exists');
        }
        const voucherPayload = await this.resolveVoucherImagePayload(
            data,
            file,
        );

        const voucher = await this.prismaService.client.voucher.create({
            data: {
                name: voucherPayload.name!,
                code: voucherPayload.code!,
                description: voucherPayload.description ?? '',
                image: voucherPayload.image ?? '',
                sale: voucherPayload.sale!,
                type: voucherPayload.type!,
                status: voucherPayload.status ?? VoucherStatus.APPLYING,
                restaurantId: voucherPayload.restaurantId,
                minimumOrderAmount: voucherPayload.minimumOrderAmount ?? 0,
                maximumDiscountAmount: voucherPayload.maximumDiscountAmount,
                startAt: voucherPayload.startAt
                    ? new Date(voucherPayload.startAt)
                    : undefined,
                endAt: voucherPayload.endAt
                    ? new Date(voucherPayload.endAt)
                    : undefined,
            },
        });

        await this.auditService.log(
            'CREATE_VOUCHER',
            'Voucher',
            voucher.id,
            actorId,
            data,
        );

        if (voucher.status === VoucherStatus.APPLYING) {
            try {
                let restaurantName = '';
                if (voucher.restaurantId) {
                    const restaurant = await this.prismaService.client.restaurant.findUnique({
                        where: { id: voucher.restaurantId },
                        select: { name: true }
                    });
                    if (restaurant) {
                        restaurantName = ` at ${restaurant.name}`;
                    }
                }

                const customers = await this.prismaService.client.user.findMany({
                    where: {
                        deleteAt: null,
                        userRoles: {
                            some: {
                                role: Role.CUSTOMER,
                                deleteAt: null,
                            }
                        }
                    },
                    select: { id: true }
                });

                for (const customer of customers) {
                    this.eventEmitter.emit('notification.send', {
                        recipientUserId: customer.id,
                        title: 'New Promotion Available!',
                        body: `Use code ${voucher.code} to get discount${restaurantName}.`,
                        type: NotificationType.PROMOTION,
                        targetType: 'VOUCHER',
                        targetId: voucher.id,
                        actorId,
                        metadata: {
                            voucherId: voucher.id,
                            code: voucher.code,
                        }
                    } as NotificationEvent);
                }
            } catch (err) {
                console.error('Error emitting promotion notifications:', err);
            }
        }

        return voucher;
    }

    async updateVoucher(
        actorId: number,
        roles: string[],
        id: number,
        data: UpdateVoucherDto,
        file?: Express.Multer.File,
    ) {
        const voucher = await this.prismaService.client.voucher.findFirst({
            where: {
                id,
            },
        });

        if (!voucher) {
            throw new NotFoundException('Voucher not found');
        }

        await this.assertVoucherOwner(actorId, roles, voucher.restaurantId);
        const voucherPayload = await this.resolveVoucherImagePayload(
            data,
            file,
        );

        const updatedVoucher = await this.prismaService.client.voucher.update({
            where: {
                id,
            },
            data: {
                ...voucherPayload,
                startAt: voucherPayload.startAt
                    ? new Date(voucherPayload.startAt)
                    : undefined,
                endAt: voucherPayload.endAt
                    ? new Date(voucherPayload.endAt)
                    : undefined,
            },
        });

        await this.auditService.log(
            'UPDATE_VOUCHER',
            'Voucher',
            id,
            actorId,
            data,
        );

        return updatedVoucher;
    }

    async endVoucher(actorId: number, roles: string[], id: number) {
        const voucher = await this.prismaService.client.voucher.findFirst({
            where: {
                id,
            },
        });

        if (!voucher) {
            throw new NotFoundException('Voucher not found');
        }

        await this.assertVoucherOwner(actorId, roles, voucher.restaurantId);

        const updatedVoucher = await this.prismaService.client.voucher.update({
            where: {
                id,
            },
            data: {
                status: VoucherStatus.ENDED,
            },
        });

        await this.auditService.log(
            'END_VOUCHER',
            'Voucher',
            id,
            actorId,
        );

        return updatedVoucher;
    }
}
