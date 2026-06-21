import { Module } from '@nestjs/common';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { RolesGuard } from '@/bases/guards/role.guard';

@Module({
    imports: [],
    controllers: [CategoryController],
    providers: [CategoryService, RolesGuard],
})
export class CategoryModule {}
