import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class FoodService {
    constructor(private readonly prismaService: PrismaService) {}
    async getAllFood(limit: number, offset: number, name: string) {
        try {
            const foods = await this.prismaService.client.food.findMany({
                take: limit,
                skip: offset,
                where: {
                    name: {
                        contains: name,
                        mode: 'insensitive',
                    },
                },
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });
            return foods;
        } catch (err) {
            console.log('Get all food error: ', err);
            throw err;
        }
    }
    async getFoodDetail(id: number) {
        try {
            const food = await this.prismaService.client.food.findFirst({
                where: { id },
                include: {
                    category: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    foodIngredients: {
                        select: {
                            ingredient: {
                                select: { id: true, name: true, icon: true },
                            },
                        },
                    },
                },
            });
            if (!food) throw new NotFoundException('Food not found');
            const takeFood = {
                ...food,
                foodIngredients: food.foodIngredients.map((ingredient) => {
                    return { ...ingredient.ingredient };
                }),
            };
            return takeFood;
        } catch (err) {
            console.log('Get food detail error', err);
            throw err;
        }
    }
}
