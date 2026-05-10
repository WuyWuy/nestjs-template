import { Body, Controller, Post } from "@nestjs/common";
import { CheckingPaymentDto } from "./dto/payment.dto";
import { PaymentService } from "./payment.service";

@Controller("payment") 
export class PaymentController 
{
    constructor(
        private readonly paymentService : PaymentService
    ) {}
    // @Post()
    // async payOrder(
    //     @Body() data : CreatePaymentDto
    // ) 
    // {
    //     const response = await this.paymentService.createPayment(PaymentMethod.MOMO , new Prisma.Decimal(data.amount))
    //     console.log(response) 
    //     return response 
    // }
    @Post("check-payment") 
    async checkPayment(
        @Body() data : CheckingPaymentDto
    )  
    {
        const response = await this.paymentService.updateMoMoPaymentStatus(data.momoOrderId , data.status)
        return response
    }
}