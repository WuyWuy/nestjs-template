import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TestModule } from './modules/test/test.module';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { HttpExceptionFilter } from './bases/filters/http-exception.filter';
import { LoggingInterceptor } from './bases/interceptors/logging.interceptos';
import { TransformInterceptor } from './bases/interceptors/transform.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { TwilioModule } from './modules/twilio/twilio.module';
import { DeviceModule } from './modules/device/device.module';
import { NotificationModule } from './modules/notification/notification.module';
import { EmailModule } from './modules/email/email.module';
//Add  e module here
@Module({
    imports: [
        TestModule,
        PrismaModule,
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        AuthModule,
        TwilioModule, //Sending SmS
        DeviceModule,
        NotificationModule,
        EmailModule
    ],
    controllers: [AppController],
    providers: [
        AppService,
        {
            provide: APP_FILTER,
            useClass: HttpExceptionFilter,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: LoggingInterceptor,
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: TransformInterceptor,
        },
    ],
})
export class AppModule {}
