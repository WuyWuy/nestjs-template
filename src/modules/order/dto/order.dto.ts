import {
    IsArray,
    IsInt,
    IsOptional,
    Min,
    ValidateNested,
    ValidateIf,
    ArrayMinSize,
    IsString,
    IsEnum,
    IsBoolean,
} from 'class-validator';

import { Type } from 'class-transformer';
import { CreateAddressDto } from '@/modules/address/dto/address.dto';
import { OrderStatus, PaymentMethod } from '@prisma/client';

class CreateOrderFoodDto {
    @IsInt()
    @Type(() => Number)
    foodId: number;

    @IsInt()
    @Min(1)
    @Type(() => Number)
    quantity: number;

    @IsOptional()
    @IsString()
    fullText: string = '';

    @IsOptional()
    @IsInt()
    @Type(() => Number)
    foodSizeId?: number;
}

export class CreateOrderDto {
    @IsInt()
    restaurantId: number;

    @IsOptional()
    @IsInt()
    voucherId?: number;

    // ===== Address =====

    // User selects saved address
    @ValidateIf((o) => !o.customAddress)
    @IsInt()
    @IsOptional()
    savedAddressId?: number;

    // User enters custom address
    @ValidateIf((o) => !o.savedAddressId)
    @ValidateNested()
    @Type(() => CreateAddressDto)
    @IsOptional()
    customAddress?: CreateAddressDto;

    // ===== Foods =====

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateOrderFoodDto)
    orderFoods: CreateOrderFoodDto[];

    @IsOptional()
    @IsString()
    note?: string = '';

    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;

    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    clearCartAfterOrder?: boolean = true;
}

export class UpdateOrderStatus {
    @IsEnum(OrderStatus)
    status: OrderStatus;
}

export class GetOrdersQueryDto {
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
    @IsEnum(OrderStatus)
    status?: OrderStatus;
}
