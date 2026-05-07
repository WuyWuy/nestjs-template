import { Body, Controller, Post } from "@nestjs/common";
import { CreatePaymentDto } from "./dto/payment.dto";
import { PaymentService } from "./payment.service";
import { PaymentMethod, Prisma } from "@prisma/client";

@Controller("payment") 
export class PaymentController 
{
    constructor(
        private readonly paymentService : PaymentService
    ) {}
    @Post()
    async payOrder(
        @Body() data : CreatePaymentDto
    ) 
    {
        const response = await this.paymentService.createPayment(PaymentMethod.MOMO , new Prisma.Decimal(data.amount))
        console.log(response) 
        return response 
    }
}