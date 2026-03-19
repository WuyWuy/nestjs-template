import { Module } from '@nestjs/common';
import { FirebaseService } from './firebase/firebase.service';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { DeviceModule } from '../device/device.module';

@Module({
    imports: [DeviceModule],
    providers: [FirebaseService, NotificationService],
    controllers: [NotificationController],
})
export class NotificationModule {}
