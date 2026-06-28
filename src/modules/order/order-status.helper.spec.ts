import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfirmedBy, OrderStatus, Role } from '@prisma/client';
import {
    assertValidStatusTransition,
    buildStatusUpdateData,
    mapOrderStatusToFrontend,
    ORDER_AUTO_CONFIRM_MS,
} from './order-status.helper';

describe('order-status.helper', () => {
    it('maps backend statuses to frontend steps', () => {
        expect(mapOrderStatusToFrontend(OrderStatus.PENDING)).toEqual({
            status: 'PENDING',
            status_step: 0,
        });
        expect(mapOrderStatusToFrontend(OrderStatus.CONFIRMED)).toEqual({
            status: 'CONFIRMED',
            status_step: 4,
        });
    });

    it('sets delivering timestamp when order is out for delivery', () => {
        const update = buildStatusUpdateData(OrderStatus.DELIVERING);

        expect(update.deliveringAt).toBeInstanceOf(Date);
    });

    it('sets auto confirm timestamp when order is delivered', () => {
        const before = Date.now();
        const update = buildStatusUpdateData(OrderStatus.DELIVERED);
        const after = Date.now();

        expect(update.deliveredAt).toBeInstanceOf(Date);
        expect(update.autoConfirmAt).toBeInstanceOf(Date);
        expect(update.autoConfirmAt!.getTime()).toBeGreaterThanOrEqual(
            before + ORDER_AUTO_CONFIRM_MS,
        );
        expect(update.autoConfirmAt!.getTime()).toBeLessThanOrEqual(
            after + ORDER_AUTO_CONFIRM_MS,
        );
    });

    it('allows business to accept pending orders into preparing', () => {
        expect(() =>
            assertValidStatusTransition(
                OrderStatus.PENDING,
                OrderStatus.PREPARING,
                [Role.BUSINESS],
            ),
        ).not.toThrow();
    });

    it('allows customers to confirm delivered orders', () => {
        expect(() =>
            assertValidStatusTransition(
                OrderStatus.DELIVERED,
                OrderStatus.CONFIRMED,
                [Role.CUSTOMER],
            ),
        ).not.toThrow();
    });

    it('rejects business from setting confirmed status', () => {
        expect(() =>
            assertValidStatusTransition(
                OrderStatus.DELIVERED,
                OrderStatus.CONFIRMED,
                [Role.BUSINESS],
            ),
        ).toThrow(BadRequestException);
    });

    it('rejects customer from skipping to confirmed before delivered', () => {
        expect(() =>
            assertValidStatusTransition(
                OrderStatus.PENDING,
                OrderStatus.CONFIRMED,
                [Role.CUSTOMER],
            ),
        ).toThrow(ForbiddenException);
    });

    it('stores confirmed metadata when order is completed', () => {
        const update = buildStatusUpdateData(
            OrderStatus.CONFIRMED,
            ConfirmedBy.CUSTOMER,
        );

        expect(update.confirmedBy).toBe(ConfirmedBy.CUSTOMER);
        expect(update.confirmedAt).toBeInstanceOf(Date);
        expect(update.autoConfirmAt).toBeNull();
    });
});
