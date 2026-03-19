import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SendNotificationDto } from './dto/send-notification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}
    @UseGuards(JwtAuthGuard)
    @Post()
    async sendNotification(
        @Body() sendNotificationDto: SendNotificationDto,
        @Req() req: Request,
    ) {
        //Gui kem chung deviceId ???
        const user = req.user as any;
        const id = user.id;
        const responseData = await this.notificationService.pushNotification(
            id,
            sendNotificationDto.title,
            sendNotificationDto.body,
        );
        return responseData;
    }
    @Get('test') //Using for testing only - Not production
    async testSendNotification() {
        const DEVICE_TOKEN = 'PASTE YOUR DEVICE ID HERE';
        const responseData =
            await this.notificationService.testPushNotification(DEVICE_TOKEN);
        return responseData;
    }
}
