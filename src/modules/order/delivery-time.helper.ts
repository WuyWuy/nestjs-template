import { OrderStatus } from '@prisma/client';

export const DELIVERY_TIME_MIN_MINUTES = 10;
export const DELIVERY_TIME_MAX_MINUTES = 45;
export const DELIVERY_TIME_BASE_MINUTES = 5;
export const DELIVERY_TIME_MINUTES_PER_KM = 4;

type Coordinates = {
    latitude: number | null;
    longitude: number | null;
};

export function calculateDeliveryMinutes(distanceKm: number): number {
    const raw =
        DELIVERY_TIME_BASE_MINUTES + distanceKm * DELIVERY_TIME_MINUTES_PER_KM;
    return Math.min(
        DELIVERY_TIME_MAX_MINUTES,
        Math.max(DELIVERY_TIME_MIN_MINUTES, Math.round(raw)),
    );
}

export function resolveOrderDeliveryMinutes(
    order: { deliveryMinutes?: number | null },
    restaurantAddress?: Coordinates,
    deliveryAddress?: Coordinates,
    calculateDistance?: (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ) => number,
): number | null {
    if (order.deliveryMinutes != null) {
        return order.deliveryMinutes;
    }

    if (
        !restaurantAddress ||
        !deliveryAddress ||
        !calculateDistance ||
        restaurantAddress.latitude == null ||
        restaurantAddress.longitude == null ||
        deliveryAddress.latitude == null ||
        deliveryAddress.longitude == null
    ) {
        return null;
    }

    const distanceKm = calculateDistance(
        restaurantAddress.latitude,
        restaurantAddress.longitude,
        deliveryAddress.latitude,
        deliveryAddress.longitude,
    );

    return calculateDeliveryMinutes(distanceKm);
}

export function resolveExpectedArrival(order: {
    status: OrderStatus;
    deliveringAt?: Date | null;
    deliveryMinutes?: number | null;
}): string | null {
    if (order.status !== OrderStatus.DELIVERING) {
        return null;
    }

    if (!order.deliveringAt || order.deliveryMinutes == null) {
        return null;
    }

    return new Date(
        order.deliveringAt.getTime() + order.deliveryMinutes * 60_000,
    ).toISOString();
}

export function buildOrderEtaFields(
    order: {
        status: OrderStatus;
        deliveringAt?: Date | null;
        deliveryMinutes?: number | null;
        address?: Coordinates;
    },
    restaurantAddress?: Coordinates,
    calculateDistance?: (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
    ) => number,
) {
    const delivery_minutes = resolveOrderDeliveryMinutes(
        order,
        restaurantAddress,
        order.address,
        calculateDistance,
    );

    return {
        delivery_minutes,
        delivering_at: order.deliveringAt?.toISOString() ?? null,
        expected_arrival: resolveExpectedArrival({
            status: order.status,
            deliveringAt: order.deliveringAt,
            deliveryMinutes: delivery_minutes,
        }),
    };
}

export function resolveOrderStatusUpdatedAt(
    order: {
        status: OrderStatus;
        deliveringAt?: Date | null;
        deliveredAt?: Date | null;
        confirmedAt?: Date | null;
    },
    paymentUpdatedAt?: Date | null,
): string {
    if (order.status === OrderStatus.DELIVERING && order.deliveringAt) {
        return order.deliveringAt.toISOString();
    }

    if (order.deliveredAt) {
        return order.deliveredAt.toISOString();
    }

    if (order.confirmedAt) {
        return order.confirmedAt.toISOString();
    }

    if (paymentUpdatedAt) {
        return paymentUpdatedAt.toISOString();
    }

    return new Date().toISOString();
}
