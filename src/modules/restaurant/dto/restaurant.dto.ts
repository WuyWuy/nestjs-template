import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsObject,
    IsOptional,
    IsPositive,
    IsString,
    Matches,
    Max,
    Min,
    ValidateNested,
    IsArray,
    IsIn,
} from 'class-validator';

export class GetRestaurantsQueryDto {
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
    @IsString()
    keyword?: string = '';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    categoryId?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    latitude?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    longitude?: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(0)
    @Max(5)
    minRating?: number;

    @IsOptional()
    @IsString()
    sortBy?: string;
}

export class GetRestaurantMenuQueryDto {
    @IsOptional()
    @IsString()
    keyword?: string = '';

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    categoryId?: number;
}

export const ALLOWED_REVIEW_TAGS = [
    'Delicious food',
    'Fast delivery',
    'Careful packaging',
    'Friendly attitude',
    'Reasonable price',
    'Food arrived hot',
    'Fresh ingredients',
    'Accurate order',
    'Large portions',
];

export class CreateRestaurantRatingDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5)
    vote: number;

    @IsOptional()
    @IsString()
    comment?: string = '';

    @Type(() => Number)
    @IsInt()
    @IsNotEmpty()
    orderId: number;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @IsIn(ALLOWED_REVIEW_TAGS, { each: true, message: 'Invalid review tags' })
    tags?: string[];
}

export class RestaurantIdParamDto {
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    @IsNotEmpty()
    restaurantId: number;
}

export class CreateRestaurantDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    image?: string = '';

    @IsOptional()
    @IsString()
    coverImage?: string = '';

    @IsOptional()
    @IsString()
    description?: string = '';

    @IsString()
    @IsNotEmpty()
    phone: string;

    @Type(() => Number)
    @IsInt()
    @IsPositive()
    addressId: number;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    deliveryFee?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    minimumOrder?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    estimatedDeliveryTime?: number = 20;
}

export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto) {}

export class UpdateRestaurantStatusDto {
    @IsBoolean()
    isOpen: boolean;
}

export class TimeRangeDto {
    @IsString()
    @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'Time must be in HH:MM format',
    })
    open: string;

    @IsString()
    @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
        message: 'Time must be in HH:MM format',
    })
    close: string;
}

export class OperatingHoursDto {
    @IsOptional()
    @ValidateNested()
    @Type(() => TimeRangeDto)
    monday?: TimeRangeDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => TimeRangeDto)
    tuesday?: TimeRangeDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => TimeRangeDto)
    wednesday?: TimeRangeDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => TimeRangeDto)
    thursday?: TimeRangeDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => TimeRangeDto)
    friday?: TimeRangeDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => TimeRangeDto)
    saturday?: TimeRangeDto;

    @IsOptional()
    @ValidateNested()
    @Type(() => TimeRangeDto)
    sunday?: TimeRangeDto;
}

export class UpdateOperatingHoursDto {
    @IsNotEmpty()
    @IsObject()
    @ValidateNested()
    @Type(() => OperatingHoursDto)
    operatingHours: OperatingHoursDto;
}

export class CreateRestaurantRatingReplyDto {
    @IsString()
    @IsNotEmpty()
    reply: string;
}

export class UpdateRestaurantRatingDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(5)
    vote?: number;

    @IsOptional()
    @IsString()
    comment?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @IsIn(ALLOWED_REVIEW_TAGS, { each: true, message: 'Invalid review tags' })
    tags?: string[];
}

export class DashboardRecentOrderResponse {
    @ApiProperty({ example: '9842' })
    id: string;

    @ApiProperty({ example: '9842' })
    orderNumber: string;

    @ApiProperty({ example: 'Nguyen Van A' })
    customerName: string;

    @ApiProperty({ example: 24.5 })
    totalPrice: number;

    @ApiProperty({ example: 'Delivered' })
    status: string;

    @ApiProperty({ example: '10:30 AM' })
    time: string;
}

export class DashboardBestSellerResponse {
    @ApiProperty({ example: 1 })
    id: number;

    @ApiProperty({ example: 'Burger Classic' })
    name: string;

    @ApiProperty({ example: 5.99 })
    price: number;

    @ApiProperty({ example: 4.5 })
    rating: number;

    @ApiProperty({ example: 120 })
    soldCount: number;

    @ApiProperty({ example: 'https://example.com/burger.jpg' })
    imageUrl: string;
}

export class DashboardResponse {
    @ApiProperty({ example: 20 })
    runningOrders: number;

    @ApiProperty({ example: 5 })
    orderRequest: number;

    @ApiProperty({ example: 2241 })
    revenue: number;

    @ApiProperty({ example: 4.9 })
    rating: number;

    @ApiProperty({ example: 25 })
    totalReviews: number;

    @ApiProperty({ example: 142 })
    totalOrders: number;

    @ApiProperty({
        description: 'Số voucher đang hoạt động và còn hiệu lực',
        example: 3,
    })
    activeVouchers: number;

    @ApiProperty({ type: [DashboardRecentOrderResponse] })
    recentOrders: DashboardRecentOrderResponse[];

    @ApiProperty({ type: [DashboardBestSellerResponse] })
    bestSellers: DashboardBestSellerResponse[];
}
