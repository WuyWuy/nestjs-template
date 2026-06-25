export const PLATFORM_COMMISSION_RATE = 0.1;

export function splitRevenueAmount(grossAmount: number) {
    const platformCommission = Number(
        (grossAmount * PLATFORM_COMMISSION_RATE).toFixed(2),
    );
    const restaurantNetRevenue = Number(
        (grossAmount * (1 - PLATFORM_COMMISSION_RATE)).toFixed(2),
    );

    return { platformCommission, restaurantNetRevenue };
}
