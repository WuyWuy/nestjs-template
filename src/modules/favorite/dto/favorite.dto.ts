import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class FavoriteRestaurantsQueryDto {
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
