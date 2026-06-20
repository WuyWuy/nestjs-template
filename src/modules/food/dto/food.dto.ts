import { PartialType } from '@nestjs/mapped-types';
import { Type, Transform } from 'class-transformer';
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
        if (typeof value === 'string') {
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        }
        return value;
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateFoodSizeDto)
    sizes?: CreateFoodSizeDto[];

    @IsOptional()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            if (value.startsWith('[') && value.endsWith(']')) {
                try {
                    return JSON.parse(value).map(Number);
                } catch {
                    // ignore and fallback
                }
            }
            return value.split(',').map(Number);
        }
        return value;
    })
    @IsArray()
    @IsInt({ each: true })
    @Type(() => Number)
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

