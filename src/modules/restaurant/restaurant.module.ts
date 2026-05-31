import { Module } from '@nestjs/common';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';
import { AuthModule } from '../auth/auth.module';
@Module({
    imports: [AuthModule],
    exports: [],
    providers: [RestaurantService],
    controllers: [RestaurantController],
})
export class RestaurantModule {}
