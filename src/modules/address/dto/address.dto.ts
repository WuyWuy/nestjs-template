import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    NotEquals,
} from 'class-validator';

export class CreateAddressDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @Type(() => Number)
    @IsNumber()
    @NotEquals(0, { message: 'latitude must not be 0' })
    latitude: number;

    @Type(() => Number)
    @IsNumber()
    @NotEquals(0, { message: 'longitude must not be 0' })
    longitude: number;

    @IsString()
    @IsNotEmpty()
    fullText: string;
}

export class AddressListQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @Type(() => Number)
    @IsOptional()
    @IsInt()
    @Min(0)
    offset?: number = 0;

    @IsOptional()
    @IsString()
    keyword?: string = '';
}

export class FindAddressDto extends AddressListQueryDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    fullText?: string;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    latitude?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    longitude?: number;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

export class ChangeUserAddressLocationDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    fullText: string;

    @Type(() => Number)
    @IsNumber()
    @NotEquals(0, { message: 'latitude must not be 0' })
    latitude: number;

    @Type(() => Number)
    @IsNumber()
    @NotEquals(0, { message: 'longitude must not be 0' })
    longitude: number;
}
