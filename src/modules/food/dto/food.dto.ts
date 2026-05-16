import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
    IsInt,
    IsNumberString,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class CreateFoodDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @Type(() => Number)
    @IsInt()
    @Min(1)
    categoryId: number;

    @IsNumberString()
    price: string;

    @IsOptional()
    @IsString()
    label?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    restaurantId?: number;
}

export class UpdateFoodDto extends PartialType(CreateFoodDto) {}