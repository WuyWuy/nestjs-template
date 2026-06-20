import { Module } from '@nestjs/common';
import { AddressService } from './address.service';
import { AddressController } from './address.controller';
import { AuditModule } from '../audit/audit.module';
@Module({
    imports: [AuditModule],
    providers: [AddressService],
    exports: [AddressService],
    controllers: [AddressController],
})
export class AddressModule {}
