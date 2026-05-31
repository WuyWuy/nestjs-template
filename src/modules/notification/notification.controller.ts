import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import { NotificationService } from './notification.service';
import {
    CreateNotificationDto,
    NotificationQueryDto,
} from './dto/notification.dto';

@Controller('notification')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) {}

    @UseGuards(JwtAuthGuard)
    @Post()
    async sendNotification(
        @Body() sendNotificationDto: CreateNotificationDto,
        @Req() req: Request,
    ) {
        const user = req.user as { id?: number };
        return await this.notificationService.pushNotification(
            Number(user.id),
            sendNotificationDto.title,
            sendNotificationDto.body,
            sendNotificationDto.type,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMyNotifications(
        @Req() req: Request,
        @Query() query: NotificationQueryDto,
    ) {
        const user = req.user as { id?: number };
        return await this.notificationService.getMyNotifications(
            Number(user.id),
            query,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Patch(':notificationId/read')
    async markAsRead(
        @Req() req: Request,
        @Param('notificationId', ParseIntPipe) notificationId: number,
    ) {
        const user = req.user as { id?: number };
        return await this.notificationService.markAsRead(
            Number(user.id),
            notificationId,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Patch('read-all')
    async markAllAsRead(@Req() req: Request) {
        const user = req.user as { id?: number };
        return await this.notificationService.markAllAsRead(Number(user.id));
    }

    @Get('test') //Using for testing only - Not production
    async testSendNotification() {
        const DEVICE_TOKEN = 'PASTE YOUR DEVICE ID HERE';
        return await this.notificationService.testPushNotification(DEVICE_TOKEN);
    }
}
