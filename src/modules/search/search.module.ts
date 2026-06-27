import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { VoucherModule } from '../voucher/voucher.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
    imports: [PrismaModule, VoucherModule],
    controllers: [SearchController],
    providers: [SearchService],
    exports: [SearchService],
})
export class SearchModule {}
