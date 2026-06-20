import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class CreateCartItemDto {
    @IsInt()
    @IsNotEmpty()
    foodId: number;

    @IsInt()
    @IsNotEmpty()
    @Min(1)
    quantity: number;
}

export class UpdateCartItemDto {
    @IsInt()
    @IsNotEmpty()
    @Min(0)
    quantity: number;
}
