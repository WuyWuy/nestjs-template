import {
    IsDecimal,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsString,
} from 'class-validator';

import { PaymentMethod, PaymentStatus } from '@prisma/client';

export class CreatePaymentDto {
    @IsInt()
    orderId: number;

    @IsEnum(PaymentMethod)
    method: PaymentMethod;

    @IsDecimal()
    amount: string;
}
export class CheckingPaymentDto {
    @IsString() 
    @IsNotEmpty() 
    momoOrderId : string; 
    @IsEnum(PaymentStatus) 
    status : PaymentStatus
}