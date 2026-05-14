import { Module } from '@nestjs/common';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { RolesGuard } from '@/bases/guards/role.guard';

@Module({
    imports: [],
    controllers: [CouponController],
    providers: [CouponService, RolesGuard],
})
export class CouponModule {}
