import { PartialType } from '@nestjs/mapped-types';
import { Type, Transform, plainToInstance } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    Max,
    Min,
    ValidateNested,
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

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    minPrice?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    maxPrice?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(5)
    minRating?: number;

    @IsOptional()
    @IsString()
    sortBy?: string;
}

export class CreateFoodSizeDto {
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    sizeId: number;

    @Type(() => Number)
    @IsNumber()
    @IsPositive()
    price: number;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    isDefault?: boolean = false;
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

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    price?: number;

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

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value !== 'string') 
            return value 
        try 
        {
            const parsed = JSON.parse(value) 
            return Array.isArray(parsed) ? plainToInstance(CreateFoodSizeDto , parsed) : parsed 
        }  
        catch {
            return value 
        }
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateFoodSizeDto)
    sizes?: CreateFoodSizeDto[];

    @IsOptional() 
    @Transform(({ value }) => {
        if (Array.isArray(value)) {
            return value.map(Number);
        }

        if (typeof value === 'string') {
            try {
                return JSON.parse(value).map(Number);
            } catch {
                return value.split(',').map(Number);
            }
        }

        return value;
    })
    @IsArray()
    @IsInt({ each: true })
    ingredientIds?: number[];
}

export class UpdateFoodDto extends PartialType(CreateFoodDto) {}

export class CreateFoodRatingDto {
    @IsInt()
    @Min(1)
    @Max(5)
    vote: number;

    @IsOptional()
    @IsString()
    comment?: string = '';

    @IsInt()
    @IsNotEmpty()
    orderId: number;
}
