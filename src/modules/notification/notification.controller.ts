import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SendNotificationDto } from './dto/send-notification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import { NotificationService } from './notification.service';

@Controller('notification')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}
    /**
     * API gửi notification cho tất cả thiết bị của user hiện tại.
     * Route: POST /notification
     * Bảo mật: yêu cầu JWT (Authentication)
     * Body: { title, body }
     * Ghi chú: API này thường do hệ thống (admin/owner) gọi để gửi thông báo đến user.
     */
    @UseGuards(JwtAuthGuard)
    @Post()
    async sendNotification(
        @Body() sendNotificationDto: SendNotificationDto,
        @Req() req: Request,
    ) {
        // Lấy userId từ token
        const user = req.user as any;
        const id = user.id;
        const responseData = await this.notificationService.pushNotification(
            id,
            sendNotificationDto.title,
            sendNotificationDto.body,
        );
        return responseData;
    }

    /**
     * Endpoint test (chỉ dùng dev) để gửi notification đến một device token cụ thể.
     * Route: GET /notification/test
     * LƯU Ý: Không dùng endpoint này ở production.
     */
    @Get('test') //Using for testing only - Not production
    async testSendNotification() {
        const DEVICE_TOKEN = 'PASTE YOUR DEVICE ID HERE';
        const responseData =
            await this.notificationService.testPushNotification(DEVICE_TOKEN);
        return responseData;
    }
}
