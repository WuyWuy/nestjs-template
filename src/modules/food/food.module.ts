import { Module } from '@nestjs/common';
import { FoodController } from './food.controller';
import { FoodService } from './food.service';
@Module({
    imports: [],
    exports: [],
    providers: [FoodService],
    controllers: [FoodController],
})
export class FoodModule {}
