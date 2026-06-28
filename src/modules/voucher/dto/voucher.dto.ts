import { PartialType } from '@nestjs/mapped-types';
import { VoucherStatus, VoucherType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsDateString,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsPositive,
    IsString,
    Min,
} from 'class-validator';

export class VoucherListQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    restaurantId?: number;

    @IsOptional()
    @IsString()
    code?: string;

    @IsOptional()
    @IsString()
    keyword?: string;

    @IsOptional()
    @IsEnum(VoucherStatus)
    status?: VoucherStatus;
}

export class CreateVoucherDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    code: string;

    @IsOptional()
    @IsString()
    description?: string = '';

    @IsOptional()
    @IsString()
    image?: string = '';

    @Type(() => Number)
    @IsNumber()
    sale: number;

    @IsEnum(VoucherType)
    type: VoucherType;

    @IsOptional()
    @IsEnum(VoucherStatus)
    status?: VoucherStatus = VoucherStatus.APPLYING;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    restaurantId?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    minimumOrderAmount?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    maximumDiscountAmount?: number;

    @IsOptional()
    @IsDateString()
    startAt?: string;

    @IsOptional()
    @IsDateString()
    endAt?: string;
}

export class UpdateVoucherDto extends PartialType(CreateVoucherDto) {}
