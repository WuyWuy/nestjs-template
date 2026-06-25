import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { parseDateBoundary } from '@/utilis/parse-date-boundary';

export function buildRevenueOrderWhere(options: {
    restaurantId?: number;
    startDate?: string;
    endDate?: string;
}): Prisma.OrderWhereInput {
    const { restaurantId, startDate, endDate } = options;
    const confirmedAtFilter =
        startDate || endDate
            ? {
                  gte: startDate
                      ? parseDateBoundary(startDate, false)
                      : undefined,
                  lte: endDate
                      ? parseDateBoundary(endDate, true)
                      : undefined,
              }
            : undefined;

    return {
        ...(restaurantId !== undefined ? { restaurantId } : {}),
        status: OrderStatus.CONFIRMED,
        deleteAt: null,
        confirmedAt: confirmedAtFilter ?? { not: null },
        payments: {
            some: {
                paymentStatus: PaymentStatus.DONE,
            },
        },
    };
}

export function buildRevenueFilters(startDate?: string, endDate?: string) {
    return {
        startDate: startDate
            ? parseDateBoundary(startDate, false).toISOString()
            : null,
        endDate: endDate
            ? parseDateBoundary(endDate, true).toISOString()
            : null,
    };
}
