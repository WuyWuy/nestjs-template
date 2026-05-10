import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';

@Module({
    imports: [AuthModule],
    providers: [PaymentService],
    exports: [PaymentService],
    controllers: [PaymentController],
})
export class PaymentModule {}
