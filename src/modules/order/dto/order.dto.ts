import {
    IsArray,
    IsInt,
    IsOptional,
    Min,
    ValidateNested,
    ValidateIf,
    ArrayMinSize,
    IsString,
} from 'class-validator';

import { Type } from 'class-transformer';
import { CreateAddressDto } from '@/modules/address/dto/address.dto';

class CreateOrderFoodDto {
    @IsInt()
    foodId: number;

    @IsInt()
    @Min(1)
    quantity: number;
    @IsOptional() 
    @IsString() 
    fullText : string = ""; 
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
}
