import {
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConversationDto {
    @IsInt()
    @IsPositive()
    @Type(() => Number)
    @IsNotEmpty()
    sellerId: number;
}

export class ConversationDetailQueryDto {
    @IsOptional()
    @IsInt()
    @Type(() => Number)
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    @Min(0)
    offset?: number = 0;
}
