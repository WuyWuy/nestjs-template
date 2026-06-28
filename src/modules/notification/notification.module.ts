import { Module } from '@nestjs/common';
import { FirebaseService } from './firebase/firebase.service';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { DeviceModule } from '../device/device.module';
import { AuthModule } from '../auth/auth.module';

@Module({
    imports: [DeviceModule, AuthModule],
    providers: [FirebaseService, NotificationService],
    controllers: [NotificationController],
})
export class NotificationModule { }
