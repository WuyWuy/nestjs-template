import { Module } from '@nestjs/common';
import { FoodController } from './food.controller';
import { FoodService } from './food.service';
import { MinioModule } from '../minio/minio.module';
@Module({
    imports: [MinioModule],
    exports: [],
    providers: [FoodService],
    controllers: [FoodController],
})
export class FoodModule {}
