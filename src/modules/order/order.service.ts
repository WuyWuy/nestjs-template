//Build with Kha An and Claude Code => Dev sắp thất nghiệp rồi nhé
//Một mình 1 thằng 1 AI vẫn xử đc thì tuyển thêm làm mịa gì?
import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateOrderDto, UpdateOrderStatus } from './dto/order.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { AddressService } from '../address/address.service';
import {
    OrderStatus,
    PaymentMethod,
    Prisma,
    VoucherType,
} from '@prisma/client';
import { PaymentService } from '../payment/payment.service';
type FoodType = {
    name: string;
    id: number;
    deleteAt: Date | null;
    description: string;
    categoryId: number;
    price: Prisma.Decimal;
    image: string;
    label: string;
    rating: number;
    restaurantId: number;
};
@Injectable()
export class OrderService {
    constructor(
        private prismaService: PrismaService,
        private addressService: AddressService,
        private paymentService: PaymentService,
    ) {}
    //____________________HELPER

    /**
     * Validate that all foods belong to the same restaurant.
     * Throws error if foods are from different restaurants.
     */
    private validateFoodsFromSameRestaurant(foods: FoodType[]) {
        if (foods.length === 0) {
            throw new BadRequestException('No foods provided');
        }
        const firstRestaurantId = foods[0].restaurantId;
        for (const food of foods) {
            if (food.restaurantId !== firstRestaurantId) {
                throw new BadRequestException(
                    'All foods must belong to the same restaurant',
                );
            }
        }
    }

    /**
     * Calculate discount amount based on fixed money discount.
     * Returns final price after discount (minimum 0).
     */
    private calculateMoneyDiscount(
        totalPrice: Prisma.Decimal,
        discountAmount: number,
    ): number {
        return Math.max(0, Number(totalPrice) - discountAmount);
    }

    /**
     * Calculate discount amount based on percentage discount.
     * Input: percentage as whole number (e.g., 20 = 20%) or decimal (e.g., 0.2 = 20%)
     * Returns final price after discount (minimum 0).
     */
    private calculatePercentDiscount(
        totalPrice: Prisma.Decimal,
        discountPercent: number,
    ): number {
        // Normalize percentage to decimal (0-1)
        const normalizedPercent =
            discountPercent > 1 ? discountPercent / 100 : discountPercent;
        const discountAmount = Number(totalPrice) * normalizedPercent;
        return Math.max(0, Math.floor(Number(totalPrice) - discountAmount));
    }
    //_________________Business Logic
    async createOrder(userId: number, data: CreateOrderDto) {
        try {
            const result = await this.prismaService.transaction(async (tx) => {
                let totalPrice = new Prisma.Decimal(0);
                let voucherId: number | undefined;
                let address = null;
                let realAddressId: number;
                let saleOff = 0;
                let voucherType: VoucherType | undefined;

                if (data.customAddress) {
                    address = await this.addressService.createAddress(
                        data.customAddress,
                        tx, // Transactional client
                    );
                    realAddressId = address.id;
                } else {
                    address = await tx.userAddress.findFirst({
                        where: {
                            id: data.savedAddressId,
                        },
                    });
                    if (!address || address.userId !== userId) {
                        throw new BadRequestException(
                            'This address does not belong to the user',
                        );
                    }
                    realAddressId = address.addressId;
                }

                if (!address) {
                    throw new BadRequestException('Address is required');
                }

                //______ Checking order voucher
                if (data.voucherId) {
                    const v = await tx.voucher.findFirst({
                        where: {
                            id: data.voucherId,
                            deleteAt: null, // Only use non-deleted vouchers
                        },
                    });
                    if (!v) {
                        throw new BadRequestException(
                            'Voucher not found or has been deleted',
                        );
                    }
                    voucherId = v.id;
                    saleOff = v.sale;
                    voucherType = v.type;
                }
                //______Checking restaurant
                const restaurant = await tx.restaurant.findFirst({
                    where: {
                        id: data.restaurantId,
                        deleteAt: null, // Only allow active restaurants
                    },
                });
                if (!restaurant)
                    throw new BadRequestException(
                        'Restaurant not found or has been deleted',
                    );
                //______ Create snapshot order data
                const orderData = {
                    restaurantId: data.restaurantId,
                    status: OrderStatus.PREPARING, //default value
                    totalPrice: 0,
                    userId,
                    ...(voucherId && { voucherId }),
                    addressId: realAddressId,
                };
                //_________Create snapshot for order____________
                const order = await tx.order.create({
                    data: orderData,
                });

                // Filter food to update
                const orderFoodMap = new Map<
                    number,
                    { quantity: number; fullText: string }
                >();
                for (let orderFood of data.orderFoods)
                    orderFoodMap.set(orderFood.foodId, {
                        quantity: orderFood.quantity,
                        fullText: orderFood.fullText || '',
                    });

                const foodIds = [...orderFoodMap.keys()];
                const foods = await tx.food.findMany({
                    where: {
                        id: {
                            in: foodIds,
                        },
                        deleteAt: null, // Only allow non-deleted foods
                    },
                });
                if (foodIds.length !== foods.length)
                    throw new BadRequestException(
                        'Some foods not found or have been deleted',
                    );
                //____________Validate all foods from same restaurant
                this.validateFoodsFromSameRestaurant(foods);
                const orderFoodData = foods.map((food) => {
                    const orderFood = orderFoodMap.get(food.id);
                    if (!orderFood) {
                        throw new Error(
                            `Food ${food.id} not found in order map`,
                        );
                    }
                    totalPrice = totalPrice.plus(
                        food.price.mul(orderFood.quantity),
                    );
                    return {
                        fullText: orderFoodMap.get(food.id)?.fullText || '',
                        quantity: orderFood.quantity,
                        price: food.price.mul(orderFood.quantity),
                        orderId: order.id,
                        foodId: food.id,
                    };
                });

                await tx.orderFood.createMany({
                    data: orderFoodData,
                });
                // ==================== CALCULATE FINAL PRICE WITH DISCOUNT ====================
                let finalPrice = Math.ceil(Number(totalPrice));

                if (saleOff && voucherType) {
                    if (voucherType === VoucherType.MONEY) {
                        finalPrice = this.calculateMoneyDiscount(
                            totalPrice,
                            saleOff,
                        );
                    } else if (voucherType === VoucherType.PERCENT) {
                        finalPrice = this.calculatePercentDiscount(
                            totalPrice,
                            saleOff,
                        );
                    }
                }

                // ==================== UPDATE ORDER WITH FINAL PRICE ====================
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        totalPrice: finalPrice,
                    },
                });
                // ==================== PAYMENT CREATION ====================
                let paymentInformation = {};
                if (data.paymentMethod === PaymentMethod.MOMO) {
                    paymentInformation =
                        await this.paymentService.createMoMoPayment(
                            order.id,
                            finalPrice,
                            tx,
                        );
                } else if (data.paymentMethod === PaymentMethod.CASH) {
                    paymentInformation =
                        await this.paymentService.createCashPayment(
                            order.id,
                            finalPrice,
                            tx,
                        );
                } else {
                    throw new BadRequestException('Invalid payment method');
                }
                return {
                    order,
                    orderFoodData,
                    paymentInformation,
                };
            });
            return result;
        } catch (err) {
            console.error('Create order error:', err);
            throw err;
        }
    }
    async getAllOrders(userId: number, limit: number, offset: number) {
        try {
            console.log(userId);
            let orders = await this.prismaService.client.order.findMany({
                where: {
                    userId,
                },
                select: {
                    id: true,
                    totalPrice: true,
                    status: true,
                    restaurant: {
                        select: { id: true, name: true },
                    },
                    orderFoods: {
                        select: {
                            quantity: true,
                            food: { select: { id: true, name: true } },
                        },
                    },
                    voucher: {
                        select: {
                            name: true,
                        },
                    },
                    payments: {
                        select: {
                            paymentStatus: true,
                            method: true,
                        },
                    },
                },
                take: limit,
                skip: offset,
            });

            const result = orders.map((order) => {
                return {
                    ...order,
                    orderFoods: order.orderFoods.map((orderFood) => {
                        return {
                            id: orderFood.food.id,
                            name: orderFood.food.name,
                            quantity: orderFood.quantity,
                        };
                    }),
                    payments: order.payments[0],
                    voucher: order.voucher?.name,
                };
            });
            console.log('Ham lay du lieu:');
            return result;
        } catch (err) {
            console.log('Get all payment error', err);
            throw err;
        }
    }
    async getOrderDetail(userId: number, orderId: number) {
        try {
            const order = await this.prismaService.client.order.findFirst({
                where: {
                    userId,
                    id: orderId,
                },
                select: {
                    id: true,
                    totalPrice: true,
                    status: true,
                    restaurant: {
                        select: { id: true, name: true },
                    },
                    orderFoods: {
                        select: {
                            quantity: true,
                            food: { select: { id: true, name: true } },
                        },
                    },
                    voucher: {
                        select: {
                            name: true,
                        },
                    },
                    payments: {
                        select: {
                            paymentStatus: true,
                            method: true,
                        },
                    },
                },
            });
            const result = {
                ...order,
                orderFoods: order?.orderFoods.map((orderFood) => {
                    return {
                        id: orderFood.food.id,
                        name: orderFood.food.name,
                        quantity: orderFood.quantity,
                    };
                }),
                payments: order?.payments[0],
                voucher: order?.voucher?.name,
            };
            return result;
        } catch (err) {
            console.log('Get all payment error', err);
            throw err;
        }
    }
    async deleteOrderById(userId: number, orderId: number) {
        try {
            await this.prismaService.client.order.delete({
                userId,
                id: orderId,
            });
            return {
                message: 'Delete successfully',
            };
        } catch (err) {
            console.log('Delete order error', err);
            throw err;
        }
    }
    async updateOrderStatus(
        userId: number,
        orderId: number,
        data: UpdateOrderStatus,
    ) {
        try {
            const order = await this.prismaService.client.order.update({
                where: {
                    userId,
                    id: orderId,
                },
                data: {
                    status: data.status,
                },
            });
            return order 
        } catch (err) {
            console.log('Update order status error', err);
            throw err;
        }
    }
}
