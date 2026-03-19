import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceService } from './device.service';
import { DeviceController } from './device.controller';

@Module({
    imports: [AuthModule],
    providers: [DeviceService],
    controllers: [DeviceController],
    exports: [DeviceService],
})
export class DeviceModule {}
