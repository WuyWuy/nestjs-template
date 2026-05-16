/**
 * Response DTO for per-restaurant statistics.
 *
 * Fields:
 * - totalOrders: total number of orders for the restaurant in the requested range
 * - totalRevenue: total revenue (number, converted from Decimal)
 * - averageRating: average vote value (0..5)
 * - totalRatings: number of rating records
 * - totalFoods: number of active foods on the menu
 *
 * NOTE: If FE requires time-series data (per-day or per-week), extend this DTO
 * or create a new one that includes an array of { date, value } items.
 */
export class RestaurantStatsDto {
    totalOrders: number;
    totalRevenue: number;
    averageRating: number;
    totalRatings: number;
    totalFoods: number;
}