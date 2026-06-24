import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {
    OrderStatus,
    PaymentStatus,
    NotificationType,
    RestaurantApprovalStatus,
    TokenType,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
    AdminResetPasswordDto,
    AdminUsersQueryDto,
    AuditLogQueryDto,
    BlockUserDto,
    PaymentAdminQueryDto,
    RevenueDetailsQueryDto,
} from './dto/admin.dto';
import { generatePassword } from '@/utilis/rnadomPassword';
import { EmailService } from '../email/email.service';
import { APP_NAME } from '@/bases/commons/constants/app.constant';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationEvent } from '../notification/events/notification.event';

const ADMIN_COMMISSION_RATE = 0.1;

function parseDateBoundary(value: string, endOfDay: boolean) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
        return new Date(`${value}T${time}Z`);
    }
    return new Date(value);
}

@Injectable()
export class AdminService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly auditService: AuditService,
        private readonly emailService: EmailService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async getDashboardSummary(actorId: number) {
        const [
            users,
            restaurants,
            orders,
            payments,
            categories,
            vouchers,
            deliveredOrdersAggregate,
        ] = await Promise.all([
            this.prismaService.client.user.count(),
            this.prismaService.client.restaurant.count(),
            this.prismaService.client.order.count(),
            this.prismaService.client.payment.count(),
            this.prismaService.client.category.count(),
            this.prismaService.client.voucher.count(),
            this.prismaService.client.order.aggregate({
                where: {
                    status: OrderStatus.CONFIRMED,
                    payments: {
                        some: {
                            paymentStatus: PaymentStatus.DONE,
                        },
                    },
                },
                _sum: {
                    totalPrice: true,
                },
            }),
        ]);

        await this.auditService.log(
            'ADMIN_VIEW_DASHBOARD',
            'Dashboard',
            null,
            actorId,
        );

        return {
            users,
            restaurants,
            orders,
            payments,
            categories,
            vouchers,
            deliveredRevenue: Number(
                deliveredOrdersAggregate._sum.totalPrice ?? 0,
            ),
        };
    }

    async getRevenueSummary(actorId: number) {
        const deliveredOrdersAggregate = await this.prismaService.client.order.aggregate({
            where: {
                status: OrderStatus.CONFIRMED,
                payments: {
                    some: {
                        paymentStatus: PaymentStatus.DONE,
                    },
                },
            },
            _sum: {
                totalPrice: true,
            },
        });

        const grossRevenue = Number(deliveredOrdersAggregate._sum.totalPrice ?? 0);
        const adminCommissionRate = ADMIN_COMMISSION_RATE;
        const adminRevenue = Number((grossRevenue * adminCommissionRate).toFixed(2));

        const groupedOrders = await this.prismaService.client.order.groupBy({
            by: ['restaurantId'],
            where: {
                status: OrderStatus.CONFIRMED,
                payments: {
                    some: {
                        paymentStatus: PaymentStatus.DONE,
                    },
                },
            },
            _sum: {
                totalPrice: true,
            },
        });

        const restaurantIds = groupedOrders.map((g) => g.restaurantId);
        const restaurantsInfo = await this.prismaService.client.restaurant.findMany({
            where: {
                id: {
                    in: restaurantIds,
                },
            },
            select: {
                id: true,
                name: true,
            },
        });

        const restaurantMap = new Map(
            restaurantsInfo.map((r) => [r.id, r.name]),
        );

        const restaurantsBreakdown = groupedOrders.map((g) => {
            const rGross = Number(g._sum.totalPrice ?? 0);
            return {
                restaurantId: g.restaurantId,
                restaurantName: restaurantMap.get(g.restaurantId) ?? `Restaurant #${g.restaurantId}`,
                grossRevenue: rGross,
                adminRevenue: Number(
                    (rGross * ADMIN_COMMISSION_RATE).toFixed(2),
                ),
            };
        });

        await this.auditService.log(
            'ADMIN_VIEW_REVENUE',
            'Revenue',
            null,
            actorId,
        );

        return {
            grossRevenue,
            adminCommissionRate,
            adminRevenue,
            restaurants: restaurantsBreakdown,
        };
    }

    async getRevenueDetails(
        actorId: number,
        query: RevenueDetailsQueryDto,
    ) {
        const limit = query.limit ?? 20;
        const offset = query.offset ?? 0;
        const completedAtFilter =
            query.startDate || query.endDate
                ? {
                      gte: query.startDate
                          ? parseDateBoundary(query.startDate, false)
                          : undefined,
                      lte: query.endDate
                          ? parseDateBoundary(query.endDate, true)
                          : undefined,
                  }
                : undefined;
        const where = {
            status: OrderStatus.CONFIRMED,
            confirmedAt: completedAtFilter ?? {
                not: null,
            },
            payments: {
                some: {
                    paymentStatus: PaymentStatus.DONE,
                },
            },
        };

        const [orders, total] = await Promise.all([
            this.prismaService.client.order.findMany({
                where,
                select: {
                    id: true,
                    totalPrice: true,
                    confirmedAt: true,
                    restaurant: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: {
                    confirmedAt: 'desc',
                },
                take: limit,
                skip: offset,
            }),
            this.prismaService.client.order.count({ where }),
        ]);

        await this.auditService.log(
            'ADMIN_VIEW_REVENUE_DETAILS',
            'Revenue',
            null,
            actorId,
            { filters: query },
        );

        return {
            success: true,
            data: orders.map((order) => {
                const totalAmount = Number(order.totalPrice);
                return {
                    orderId: `ORD-${order.id}`,
                    restaurantId: order.restaurant.id,
                    restaurantName: order.restaurant.name,
                    totalAmount,
                    netRevenue: Number(
                        (totalAmount * ADMIN_COMMISSION_RATE).toFixed(2),
                    ),
                    completedAt: order.confirmedAt,
                };
            }),
            total,
            limit,
            offset,
        };
    }

    async getUsers(actorId: number, query: AdminUsersQueryDto) {
        const limit = query.limit ?? 20;
        const offset = query.offset ?? 0;
        const where = {
            deleteAt: null,
            OR: query.keyword
                ? [
                      {
                          name: {
                              contains: query.keyword,
                              mode: 'insensitive' as const,
                          },
                      },
                      {
                          email: {
                              contains: query.keyword,
                              mode: 'insensitive' as const,
                          },
                      },
                      {
                          phone: {
                              contains: query.keyword,
                              mode: 'insensitive' as const,
                          },
                      },
                  ]
                : undefined,
            userRoles: query.role
                ? {
                      some: {
                          role: query.role,
                          deleteAt: null,
                      },
                  }
                : undefined,
        };

        const [users, total] = await Promise.all([
            this.prismaService.client.user.findMany({
                where,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    active: true,
                    isBlocked: true,
                    blockedReason: true,
                    blockedAt: true,
                    createdAt: true,
                    userRoles: {
                        where: {
                            deleteAt: null,
                        },
                        select: {
                            role: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                take: limit,
                skip: offset,
            }),
            this.prismaService.client.user.count({ where }),
        ]);

        await this.auditService.log(
            'ADMIN_VIEW_USERS',
            'User',
            null,
            actorId,
            { filters: query },
        );

        return {
            success: true,
            data: users.map(({ userRoles, ...user }) => ({
                ...user,
                roles: userRoles.map((item) => item.role),
            })),
            total,
            limit,
            offset,
        };
    }

    async updateUserBlockStatus(
        actorId: number,
        userId: number,
        data: BlockUserDto,
    ) {
        if (actorId === userId && data.isBlocked) {
            throw new BadRequestException(
                'Administrators cannot block their own account',
            );
        }

        const user = await this.prismaService.client.user.findFirst({
            where: {
                id: userId,
                deleteAt: null,
            },
            select: {
                id: true,
                isBlocked: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const updatedUser = await this.prismaService.client.user.update({
            where: {
                id: userId,
            },
            data: {
                isBlocked: data.isBlocked,
                blockedReason: data.isBlocked ? data.reason : null,
                blockedAt: data.isBlocked ? new Date() : null,
            },
            select: {
                id: true,
                name: true,
                email: true,
                isBlocked: true,
                blockedReason: true,
                blockedAt: true,
            },
        });

        if (data.isBlocked) {
            await this.prismaService.client.authToken.updateMany({
                where: {
                    userId,
                    type: TokenType.REFRESH,
                    usedAt: null,
                },
                data: {
                    usedAt: new Date(),
                },
            });
        }

        await this.auditService.log(
            'ADMIN_UPDATE_USER_BLOCK_STATUS',
            'User',
            userId,
            actorId,
            {
                previousStatus: user.isBlocked,
                nextStatus: data.isBlocked,
                reason: data.isBlocked ? data.reason : null,
            },
        );

        return {
            success: true,
            data: updatedUser,
        };
    }

    async updateRestaurantActiveStatus(
        actorId: number,
        restaurantId: number,
        isActive: boolean,
    ) {
        const restaurant = await this.prismaService.client.restaurant.findFirst({
            where: {
                id: restaurantId,
                deleteAt: null,
            },
            select: {
                id: true,
                isActive: true,
            },
        });

        if (!restaurant) {
            throw new NotFoundException('Restaurant not found');
        }

        const updatedRestaurant =
            await this.prismaService.client.restaurant.update({
                where: {
                    id: restaurantId,
                },
                data: {
                    isActive,
                },
            });

        await this.auditService.log(
            'ADMIN_UPDATE_RESTAURANT_ACTIVE_STATUS',
            'Restaurant',
            restaurantId,
            actorId,
            {
                previousStatus: restaurant.isActive,
                nextStatus: isActive,
            },
        );

        return {
            success: true,
            data: updatedRestaurant,
        };
    }

    async getAuditLogs(actorId: number, query: AuditLogQueryDto) {
        const logs = await this.prismaService.client.auditLog.findMany({
            where: {
                action: query.action
                    ? {
                          contains: query.action,
                          mode: 'insensitive',
                      }
                    : undefined,
                entityType: query.entityType
                    ? {
                          contains: query.entityType,
                          mode: 'insensitive',
                      }
                    : undefined,
                actorId: query.actorId,
            },
            include: {
                actor: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: query.limit ?? 20,
            skip: query.offset ?? 0,
        });

        await this.auditService.log(
            'ADMIN_READ_AUDIT_LOG',
            'AuditLog',
            null,
            actorId,
            {
                filters: {
                    action: query.action ?? null,
                    entityType: query.entityType ?? null,
                    actorId: query.actorId ?? null,
                },
            },
        );

        return logs;
    }

    async getPayments(actorId: number, query: PaymentAdminQueryDto) {
        const payments = await this.prismaService.client.payment.findMany({
            where: {
                paymentStatus: query.paymentStatus,
                method: query.method,
                order: {
                    userId: query.userId,
                    restaurantId: query.restaurantId,
                },
            },
            select: {
                id: true,
                orderId: true,
                amount: true,
                method: true,
                paymentStatus: true,
                createdAt: true,
                updatedAt: true,
                order: {
                    select: {
                        id: true,
                        status: true,
                        totalPrice: true,
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
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: query.limit ?? 20,
            skip: query.offset ?? 0,
        });

        await this.auditService.log(
            'ADMIN_VIEW_PAYMENTS',
            'Payment',
            null,
            actorId,
            {
                filters: query,
            },
        );

        return payments.map((payment) => ({
            ...payment,
            amount: Number(payment.amount),
            order: {
                ...payment.order,
                totalPrice: Number(payment.order.totalPrice),
            },
        }));
    }

    async updatePaymentStatus(
        actorId: number,
        paymentId: number,
        paymentStatus: PaymentStatus,
    ) {
        const payment = await this.prismaService.client.payment.findFirst({
            where: {
                id: paymentId,
            },
            select: {
                id: true,
                orderId: true,
                paymentStatus: true,
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        const updatedPayment = await this.prismaService.client.payment.update({
            where: {
                id: paymentId,
            },
            data: {
                paymentStatus,
            },
        });

        await this.auditService.log(
            'ADMIN_UPDATE_PAYMENT_STATUS',
            'Payment',
            paymentId,
            actorId,
            {
                orderId: payment.orderId,
                previousStatus: payment.paymentStatus,
                nextStatus: paymentStatus,
            },
        );

        return updatedPayment;
    }

    async resetUserPassword(
        actorId: number,
        userId: number,
        data: AdminResetPasswordDto,
    ) {
        const user = await this.prismaService.client.user.findFirst({
            where: {
                id: userId,
            },
            select: {
                id: true,
                email: true,
                name: true,
            },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const temporaryPassword = generatePassword();
        const hashedPassword = await Bun.password.hash(temporaryPassword, {
            cost: 10,
            algorithm: 'bcrypt',
        });

        await this.prismaService.client.user.update({
            where: {
                id: userId,
            },
            data: {
                password: hashedPassword,
            },
        });

        if (data.sendEmail && user.email) {
            await this.emailService.forgotPasswordEmail(
                `[${APP_NAME}] ADMIN RESET YOUR PASSWORD`,
                user.email,
                temporaryPassword,
            );
        }

        await this.auditService.log(
            'ADMIN_RESET_USER_PASSWORD',
            'User',
            userId,
            actorId,
            {
                sentEmail: Boolean(data.sendEmail && user.email),
            },
        );

        return {
            userId: user.id,
            email: user.email,
            temporaryPassword,
            emailSent: Boolean(data.sendEmail && user.email),
        };
    }

    async updateRestaurantApproval(
        actorId: number,
        restaurantId: number,
        status: RestaurantApprovalStatus,
    ) {
        const restaurant = await this.prismaService.client.restaurant.findFirst({
            where: {
                id: restaurantId,
            },
            select: {
                id: true,
                status: true,
                name: true,
                ownerId: true,
            },
        });

        if (!restaurant) {
            throw new NotFoundException('Restaurant not found');
        }

        const updatedRestaurant =
            await this.prismaService.client.restaurant.update({
                where: {
                    id: restaurantId,
                },
                data: {
                    status,
                },
            });

        try {
            this.eventEmitter.emit('notification.send', {
                recipientUserId: restaurant.ownerId,
                title: 'Restaurant Approval Status Update',
                body: `Your restaurant "${restaurant.name}" has been ${status === RestaurantApprovalStatus.APPROVED ? 'approved' : 'rejected'} by the administrator.`,
                type: NotificationType.SYSTEM,
                targetType: 'RESTAURANT',
                targetId: restaurantId,
                actorId,
                metadata: {
                    restaurantId,
                    status,
                },
            } as NotificationEvent);
        } catch (err) {
            console.error('Error emitting restaurant approval notification:', err);
        }

        await this.auditService.log(
            'ADMIN_UPDATE_RESTAURANT_APPROVAL',
            'Restaurant',
            restaurantId,
            actorId,
            {
                previousStatus: restaurant.status,
                nextStatus: status,
            },
        );

        return updatedRestaurant;
    }
}
