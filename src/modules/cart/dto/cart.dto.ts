import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCartItemDto {
    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    foodId: number;

    @IsInt()
    @IsNotEmpty()
    @Min(1)
    @Max(99)
    @Type(() => Number)
    quantity: number;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    foodSizeId?: number;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    fullText?: string;
}

export class UpdateCartItemDto {
    @IsInt()
    @IsNotEmpty()
    @Min(0)
    @Max(99)
    @Type(() => Number)
    quantity: number;
}
