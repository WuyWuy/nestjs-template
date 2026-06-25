import { OrderStatus, PaymentStatus } from '@prisma/client';
import { splitRevenueAmount } from '@/bases/commons/constants/revenue.constant';
import {
    buildRevenueFilters,
    buildRevenueOrderWhere,
} from './revenue.util';

describe('revenue.util', () => {
    it('builds restaurant revenue order filters', () => {
        expect(
            buildRevenueOrderWhere({
                restaurantId: 7,
                startDate: '2026-06-01',
                endDate: '2026-06-30',
            }),
        ).toEqual({
            restaurantId: 7,
            status: OrderStatus.CONFIRMED,
            deleteAt: null,
            confirmedAt: {
                gte: new Date('2026-06-01T00:00:00.000Z'),
                lte: new Date('2026-06-30T23:59:59.999Z'),
            },
            payments: {
                some: {
                    paymentStatus: PaymentStatus.DONE,
                },
            },
        });
    });

    it('splits gross revenue into platform and restaurant amounts', () => {
        expect(splitRevenueAmount(250000)).toEqual({
            platformCommission: 25000,
            restaurantNetRevenue: 225000,
        });
    });

    it('builds revenue filter echoes as ISO strings', () => {
        expect(buildRevenueFilters('2026-06-01', '2026-06-30')).toEqual({
            startDate: '2026-06-01T00:00:00.000Z',
            endDate: '2026-06-30T23:59:59.999Z',
        });
    });
});
