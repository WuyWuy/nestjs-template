import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
    @IsString()
    title: string;

    @Type(() => Number)
    @IsNumber()
    latitude: number;

    @Type(() => Number)
    @IsNumber()
    longitude: number;

    @IsString()
    @IsOptional()
    fullText?: string;
}
export class FindAddressDto {
    @Type(() => Number)
    @IsNumber()
    latitude: number;

    @Type(() => Number)
    @IsNumber()
    longitude: number;
}
