import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfirmedBy, OrderStatus, Role } from '@prisma/client';

export const ORDER_AUTO_CONFIRM_HOURS = 24;
export const ORDER_AUTO_CONFIRM_MS = ORDER_AUTO_CONFIRM_HOURS * 60 * 60 * 1000;

export const ONGOING_ORDER_STATUSES: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.PREPARING,
    OrderStatus.DELIVERING,
    OrderStatus.DELIVERED,
];

export const HISTORY_ORDER_STATUSES: OrderStatus[] = [
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,
];

export const CANCELLABLE_ORDER_STATUSES: OrderStatus[] = [
    OrderStatus.PENDING,
    OrderStatus.PREPARING,
];

const BUSINESS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
    [OrderStatus.PENDING]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
    [OrderStatus.PREPARING]: [OrderStatus.DELIVERING, OrderStatus.CANCELLED],
    [OrderStatus.DELIVERING]: [OrderStatus.DELIVERED],
};

const CUSTOMER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
    [OrderStatus.PENDING]: [OrderStatus.CANCELLED],
    [OrderStatus.PREPARING]: [OrderStatus.CANCELLED],
    [OrderStatus.DELIVERED]: [OrderStatus.CONFIRMED],
};

export function hasRole(roles: string[], role: Role) {
    return roles.includes(role);
}

export function assertValidStatusTransition(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
    roles: string[],
) {
    if (currentStatus === nextStatus) {
        throw new BadRequestException('Order is already in the requested status');
    }

    if (currentStatus === OrderStatus.CANCELLED || currentStatus === OrderStatus.CONFIRMED) {
        throw new BadRequestException(`Cannot update an order in ${currentStatus} status`);
    }

    const isCustomer = hasRole(roles, Role.CUSTOMER);
    const isBusinessOrAdmin =
        hasRole(roles, Role.BUSINESS) || hasRole(roles, Role.ADMIN);

    if (isCustomer && !isBusinessOrAdmin) {
        const allowed = CUSTOMER_TRANSITIONS[currentStatus] ?? [];
        if (!allowed.includes(nextStatus)) {
            throw new ForbiddenException(
                'Customers are only allowed to cancel orders or confirm receipt',
            );
        }
        return;
    }

    if (isBusinessOrAdmin) {
        const allowed = BUSINESS_TRANSITIONS[currentStatus] ?? [];
        if (!allowed.includes(nextStatus)) {
            throw new BadRequestException(
                `Cannot transition order from ${currentStatus} to ${nextStatus}`,
            );
        }
        return;
    }

    throw new ForbiddenException('You are not allowed to update this order status');
}

export function buildStatusUpdateData(
    nextStatus: OrderStatus,
    confirmedBy?: ConfirmedBy,
): {
    status: OrderStatus;
    deliveringAt?: Date;
    deliveredAt?: Date;
    autoConfirmAt?: Date | null;
    confirmedAt?: Date;
    confirmedBy?: ConfirmedBy;
} {
    const now = new Date();

    if (nextStatus === OrderStatus.DELIVERING) {
        return {
            status: nextStatus,
            deliveringAt: now,
        };
    }

    if (nextStatus === OrderStatus.DELIVERED) {
        return {
            status: nextStatus,
            deliveredAt: now,
            autoConfirmAt: new Date(now.getTime() + ORDER_AUTO_CONFIRM_MS),
        };
    }

    if (nextStatus === OrderStatus.CONFIRMED) {
        return {
            status: nextStatus,
            confirmedAt: now,
            confirmedBy: confirmedBy ?? ConfirmedBy.SYSTEM,
            autoConfirmAt: null,
        };
    }

    return { status: nextStatus };
}

export function mapOrderStatusToFrontend(status: OrderStatus) {
    switch (status) {
        case OrderStatus.PENDING:
            return { status: 'PENDING', status_step: 0 };
        case OrderStatus.PREPARING:
            return { status: 'PREPARING', status_step: 1 };
        case OrderStatus.DELIVERING:
            return { status: 'DELIVERING', status_step: 2 };
        case OrderStatus.DELIVERED:
            return { status: 'DELIVERED', status_step: 3 };
        case OrderStatus.CONFIRMED:
            return { status: 'CONFIRMED', status_step: 4 };
        case OrderStatus.CANCELLED:
            return { status: 'CANCELED', status_step: -1 };
        default:
            return { status: 'UNKNOWN', status_step: -1 };
    }
}

export function buildOrderTimingFields(order: {
    status: OrderStatus;
    deliveredAt?: Date | null;
    confirmedAt?: Date | null;
    confirmedBy?: ConfirmedBy | null;
    autoConfirmAt?: Date | null;
}) {
    const hoursUntilAutoConfirm =
        order.status === OrderStatus.DELIVERED && order.autoConfirmAt
            ? Math.max(
                  0,
                  Math.ceil(
                      (order.autoConfirmAt.getTime() - Date.now()) /
                          (60 * 60 * 1000),
                  ),
              )
            : null;

    return {
        delivered_at: order.deliveredAt?.toISOString() ?? null,
        confirmed_at: order.confirmedAt?.toISOString() ?? null,
        confirmed_by: order.confirmedBy ?? null,
        auto_confirm_at: order.autoConfirmAt?.toISOString() ?? null,
        hours_until_auto_confirm: hoursUntilAutoConfirm,
    };
}
