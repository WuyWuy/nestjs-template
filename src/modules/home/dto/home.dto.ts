import { IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class GetDashboardQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    lat?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    lng?: number;
}
