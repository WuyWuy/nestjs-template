import { Module } from '@nestjs/common';
import { AddressModule } from '../address/address.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { PaymentModule } from '../payment/payment.module';
import { AuthModule } from '../auth/auth.module';
import { CartModule } from '../cart/cart.module';
import { RestaurantModule } from '../restaurant/restaurant.module';

@Module({
    imports: [AddressModule, PaymentModule, AuthModule, CartModule , RestaurantModule],
    controllers: [OrderController],
    providers: [OrderService],
    exports: [OrderService],
})
export class OrderModule {}
