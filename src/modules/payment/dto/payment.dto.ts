import {
    IsDecimal,
    IsEnum,
    IsInt,
} from 'class-validator';

import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
    @IsInt()
    orderId: number;

    @IsEnum(PaymentMethod)
    method: PaymentMethod;

    @IsDecimal()
    amount: string;
}