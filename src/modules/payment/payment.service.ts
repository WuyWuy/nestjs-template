import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, Prisma } from '@prisma/client';
import { getMomoPayUrl } from './payment.utls';
@Injectable()
export class PaymentService {
    private readonly momoAccessKey: string;
    private readonly momoSecretKey: string;
    private readonly momoPartnerCode: string;

    //___________HELPER
    constructor(private readonly configService: ConfigService) {
        this.momoAccessKey = configService.getOrThrow<string>('MOMO_ACCESS_KEY');
        this.momoSecretKey = configService.getOrThrow<string>('MOMO_SECRET_KEY');
        this.momoPartnerCode = configService.getOrThrow<string>('MOMO_PARTNER_CODE');
    }
    async createPayment(method: PaymentMethod, money: number | Prisma.Decimal) {
        //Mot luc sau se switch case method 
        console.log(method)
        const payUrl = await getMomoPayUrl(
            this.momoPartnerCode, 
            this.momoAccessKey, 
            this.momoSecretKey, 
            money, 
            2   //orderId 
        ) 
        return payUrl  //Luong: FE --- Create order ----> Call API in Backend ----> Return the payUrl to backend ---> Client scan and the it will redirect to Backend again 
    }
}
