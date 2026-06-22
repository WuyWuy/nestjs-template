import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { CategoryModule } from '../category/category.module';
import { RestaurantModule } from '../restaurant/restaurant.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [
        PrismaModule,
        CategoryModule,
        RestaurantModule,
        AuthModule,
    ],
    controllers: [HomeController],
    providers: [HomeService],
})
export class HomeModule {}
