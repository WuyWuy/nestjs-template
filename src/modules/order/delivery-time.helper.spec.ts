import { OrderStatus } from '@prisma/client';
import {
    buildOrderEtaFields,
    calculateDeliveryMinutes,
    resolveExpectedArrival,
    resolveOrderDeliveryMinutes,
} from './delivery-time.helper';

describe('delivery-time.helper', () => {
    it('clamps delivery minutes by distance', () => {
        expect(calculateDeliveryMinutes(0)).toBe(10);
        expect(calculateDeliveryMinutes(3)).toBe(17);
        expect(calculateDeliveryMinutes(15)).toBe(45);
    });

    it('returns stored delivery minutes when present', () => {
        expect(
            resolveOrderDeliveryMinutes({ deliveryMinutes: 25 }),
        ).toBe(25);
    });

    it('derives delivery minutes from coordinates when snapshot is missing', () => {
        const minutes = resolveOrderDeliveryMinutes(
            { deliveryMinutes: null },
            { latitude: 10.77, longitude: 106.69 },
            { latitude: 10.8, longitude: 106.72 },
            () => 3,
        );

        expect(minutes).toBe(17);
    });

    it('returns expected arrival only while delivering', () => {
        const deliveringAt = new Date('2025-01-01T10:00:00.000Z');

        expect(
            resolveExpectedArrival({
                status: OrderStatus.PREPARING,
                deliveringAt,
                deliveryMinutes: 17,
            }),
        ).toBeNull();

        expect(
            resolveExpectedArrival({
                status: OrderStatus.DELIVERING,
                deliveringAt,
                deliveryMinutes: 17,
            }),
        ).toBe('2025-01-01T10:17:00.000Z');
    });

    it('builds eta fields for delivering orders', () => {
        const deliveringAt = new Date('2025-01-01T10:00:00.000Z');

        expect(
            buildOrderEtaFields({
                status: OrderStatus.DELIVERING,
                deliveringAt,
                deliveryMinutes: 20,
            }),
        ).toEqual({
            delivery_minutes: 20,
            delivering_at: '2025-01-01T10:00:00.000Z',
            expected_arrival: '2025-01-01T10:20:00.000Z',
        });
    });
});
