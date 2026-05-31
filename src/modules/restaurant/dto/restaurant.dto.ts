import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    Max,
    Min,
} from 'class-validator';

export class GetRestaurantsQueryDto {
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
    keyword?: string = '';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    categoryId?: number;
}

export class GetRestaurantMenuQueryDto {
    @IsOptional()
    @IsString()
    keyword?: string = '';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    categoryId?: number;
}

export class CreateRestaurantRatingDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5)
    vote: number;

    @IsOptional()
    @IsString()
    comment?: string = '';
}

export class RestaurantIdParamDto {
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    @IsNotEmpty()
    restaurantId: number;
}

export class CreateRestaurantDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    image?: string = '';

    @IsOptional()
    @IsString()
    coverImage?: string = '';

    @IsOptional()
    @IsString()
    description?: string = '';

    @IsString()
    @IsNotEmpty()
    phone: string;

    @Type(() => Number)
    @IsInt()
    @IsPositive()
    addressId: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    deliveryFee?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    minimumOrder?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    estimatedDeliveryTime?: number = 20;
}

export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto) {}
