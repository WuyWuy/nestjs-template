import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    Min,
} from 'class-validator';

export class FoodQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;

    @IsOptional()
    @IsString()
    name?: string = '';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    categoryId?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    restaurantId?: number;
}

export class CreateFoodDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    description?: string = '';

    @Type(() => Number)
    @IsInt()
    @IsPositive()
    categoryId: number;

    @Type(() => Number)
    @IsNumber()
    price: number;

    @IsOptional()
    @IsString()
    image?: string = '';

    @IsOptional()
    @IsString()
    label?: string = '';

    @Type(() => Number)
    @IsInt()
    @IsPositive()
    restaurantId: number;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isAvailable?: boolean = true;
}

export class UpdateFoodDto extends PartialType(CreateFoodDto) {}
