import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, IsDateString } from 'class-validator';

export enum DiscountType {
    PERCENTAGE = 'PERCENTAGE',
    FIXED = 'FIXED',
}

export class CreateCouponDto {
    @IsString()
    code: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsNumber()
    discountValue: number;

    @IsEnum(DiscountType)
    discountType: DiscountType;

    @IsDateString()
    startDate: string;

    @IsDateString()
    endDate: string;

    @IsOptional()
    @IsNumber()
    restaurantId?: number;

    @IsOptional()
    @IsNumber()
    minOrderValue?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class UpdateCouponDto {
    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsNumber()
    discountValue?: number;

    @IsOptional()
    @IsEnum(DiscountType)
    discountType?: DiscountType;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;

    @IsOptional()
    @IsNumber()
    restaurantId?: number;

    @IsOptional()
    @IsNumber()
    minOrderValue?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
