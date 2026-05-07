import {
    IsArray,
    IsInt,
    IsOptional,
    ValidateNested,
    IsNumber,
    IsString,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class CreateOrderFoodDto {
    @IsInt()
    foodId: number;

    @IsInt()
    @Min(1)
    quantity: number;

    @IsOptional()
    @IsNumber()
    latitude?: number;

    @IsOptional()
    @IsNumber()
    longitude?: number;

    @IsOptional()
    @IsString()
    fullText?: string;
}

export class CreateOrderDto {
    @IsInt()
    restaurantId: number;

    @IsOptional()
    @IsInt()
    voucherId?: number;

    @IsInt()
    userId: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateOrderFoodDto)
    orderFoods: CreateOrderFoodDto[];
}
