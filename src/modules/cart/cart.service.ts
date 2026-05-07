import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { CreateCartItemDto } from './dto/cart.dto';
import { UserService } from '../user/user.service';

@Injectable()
export class CartService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly userService: UserService,
    ) {}
    async getAllProducts(limit: number, offset: number) {
        try {
            const cartProducts =
                await this.prismaService.client.cartItem.findMany({
                    take: limit,
                    skip: offset,
                    select: {
                        id: true,
                        quantity: true,
                        food: {
                            select: {
                                name: true,
                                restaurantId : true , 
                                price: true,
                                category: true,
                            },
                        },
                    },
                });
            return cartProducts;
        } catch (err) {
            console.log('Get all product error', err);
            throw err;
        }
    }
    async pushCartItem(userId: number, data: CreateCartItemDto) {
        try {
            const user = await this.userService.findById(userId);
            if (user == null) throw new NotFoundException('User not found');
            if (!user.cart) {
                await this.prismaService.client.cart.create({
                    data: {
                        userId: user.id,
                    },
                });
                throw new BadRequestException(
                    'Error in creating new cart. Please try again',
                );
            }
            const existsCartItem =
                await this.prismaService.client.cartItem.findFirst({
                    where: {
                        cartId: user.cart.id,
                        foodId: data.foodId,
                    },
                });
            if (existsCartItem) {
                await this.prismaService.client.cartItem.update({
                    where: {
                        id: existsCartItem.id,
                    },
                    data: {
                        quantity: {
                            increment: data.quantity,
                        },
                    },
                });
                return existsCartItem;
            }
            const cartItem = await this.prismaService.client.cartItem.create({
                data: {
                    cartId: user.cart.id,
                    quantity: data.quantity,
                    foodId: data.foodId,
                },
            });
            return cartItem;
        } catch (err) {
            console.log('Pushing cart item error', err);
            throw err;
        }
    }
    async deleteCartById(id: number) {
        try {
            const result = await this.prismaService.transaction(async (tx) => {
                const res = await tx.cartItem.delete({
                    id,
                });
                return res;
            });
            return result;
        } catch (err) {
            console.log('Delete cart item error', err);
            throw err;
        }
    }
}
