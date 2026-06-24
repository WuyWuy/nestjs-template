import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from '../auth/auth.module';
import { VoucherModule } from '../voucher/voucher.module';

@Module({
    imports: [AuthModule , VoucherModule],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule {}
