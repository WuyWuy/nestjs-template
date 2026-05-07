import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateOrderDto } from './dto/order.dto';
import { PrismaService } from '@/prisma/prisma.service';
import { AddressService } from '../address/address.service';
import { OrderStatus, Prisma } from '@prisma/client';
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
}
@Injectable()
export class OrderService {
    constructor(
        private prismaService: PrismaService,
        private addressService: AddressService,
    ) {}
    //____________________HELPER
    
    async validateFood(foods : FoodType[]) 
    {
        for (let i  = 0; i < foods.length - 1; ++i) 
            if (foods[i].restaurantId !== foods[i + 1].restaurantId)
                return false 
        return true 
    }
    //_________________Business Logic 
    async createOrder(userId: number, data: CreateOrderDto) {
        try {
            const result = await this.prismaService.transaction(async (tx) => {
                let totalPrice = new Prisma.Decimal(0);
                let voucherId: number | undefined;
                let address = null;
                let realAddressId : number 

                if (data.customAddress)
                {
                    address = await this.addressService.createAddress(
                        data.customAddress, 
                        tx  //Transactional Variable  
                    );
                    realAddressId = address.id 
                }
                else {
                    address =
                        await tx.userAddress.findFirst({
                            where: {
                                id: data.savedAddressId,
                            },
                        });
                    if (!address || address.userId != userId)
                        throw new BadRequestException(
                            "This is not user's address",
                        );
                    realAddressId = address.addressId
                    
                }
                if (!address) throw new BadRequestException("Don't know address");
                
                //______ Checking order voucher

                if (data.voucherId) {
                    const v = await tx.voucher.findFirst(
                        {
                            where: { id: data.voucherId },
                        },
                    );
                    if (!v) throw new BadRequestException('Voucher not found');
                    voucherId = v.id;
                }
                //______Checking restaurant
                const restaurant =
                    await tx.restaurant.findFirst({
                        where: { id: data.restaurantId },
                    });
                if (!restaurant)
                    throw new BadRequestException('Restaurant not found');
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
                    },
                });
                if (!this.validateFood(foods)) 
                    throw new BadRequestException("Foods don't belong to the same restaurant") 
                if (foodIds.length != foods.length)
                    throw new BadRequestException(
                        'Some food invalid in the array',
                    );
                //____________Checking is food in the same restaurant: 
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

                // _________ Calculate total price
                await tx.orderFood.createMany({
                    data: orderFoodData,
                });
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        totalPrice,
                    },
                });
                //Calling API in order store the payment
                return {
                    order,
                    orderFoodData,
                };
            });
            return result
        } catch (err) {
            console.log('create order error', err);
            throw err;
        }
    }
}
