import { Module } from '@nestjs/common';
import { FoodController } from './food.controller';
import { FoodService } from './food.service';
import { AuthModule } from '../auth/auth.module';
@Module({
    imports: [AuthModule],
    exports: [],
    providers: [FoodService],
    controllers: [FoodController],
})
export class FoodModule {}
