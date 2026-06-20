import { IsInt, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCartItemDto {
    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    foodId: number;

    @IsInt()
    @IsNotEmpty()
    @Min(1)
    @Type(() => Number)
    quantity: number;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    foodSizeId?: number;
}

export class UpdateCartItemDto {
    @IsInt()
    @IsNotEmpty()
    @Min(0)
    @Type(() => Number)
    quantity: number;
}
