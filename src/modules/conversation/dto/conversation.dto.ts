import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConversationDto {
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    @IsNotEmpty()
    orderId: number;
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    @IsNotEmpty()
    sellerId: number;
}
