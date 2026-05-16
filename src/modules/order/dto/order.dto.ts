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
} from 'class-validator';

import { Type } from 'class-transformer';
import { CreateAddressDto } from '@/modules/address/dto/address.dto';
import { PaymentMethod, OrderStatus } from '@prisma/client';

class CreateOrderFoodDto {
    @IsInt()
    foodId: number;

    @IsInt()
    @Min(1)
    quantity: number;
    @IsOptional()
    @IsString()
    fullText: string = '';
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
    @IsEnum(PaymentMethod)
    paymentMethod: PaymentMethod;
}

/**
 * DTO dùng để cập nhật trạng thái đơn hàng
 * 
 * Các trạng thái hợp lệ:
 * - PENDING: Chờ xác nhận
 * - CONFIRMED: Đã xác nhận
 * - PREPARING: Đang chuẩn bị
 * - DELIVERING: Đang giao
 * - DELIVERED: Đã giao thành công
 * - CANCELLED: Đã hủy
 */
export class UpdateOrderStatusDto {
    /**
     * Trạng thái mới của đơn hàng
     * Phải là một trong các giá trị OrderStatus enum
     */
    @IsEnum(OrderStatus)
    status: OrderStatus;
}

