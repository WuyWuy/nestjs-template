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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import { NotificationService } from './notification.service';
import {
    CreateNotificationDto,
    NotificationQueryDto,
} from './dto/notification.dto';

@ApiTags('12. Notification')
@ApiBearerAuth()
@Controller('notification')
export class NotificationController {
    constructor(private readonly notificationService: NotificationService) { }

    @ApiOperation({ summary: 'Tạo/thử gửi thông báo' })
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

    @ApiOperation({ summary: 'Lấy thông báo của tôi' })
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

    @ApiOperation({ summary: 'Đếm số thông báo chưa đọc' })
    @UseGuards(JwtAuthGuard)
    @Get('me/unread-count')
    async getUnreadCount(@Req() req: Request) {
        const user = req.user as { id?: number };
        return await this.notificationService.getUnreadCount(Number(user.id));
    }

    @ApiOperation({ summary: 'Đánh dấu một thông báo đã đọc' })
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

    @ApiOperation({ summary: 'Đánh dấu toàn bộ thông báo đã đọc' })
    @UseGuards(JwtAuthGuard)
    @Patch('read-all')
    async markAllAsRead(@Req() req: Request) {
        const user = req.user as { id?: number };
        return await this.notificationService.markAllAsRead(Number(user.id));
    }

    @ApiOperation({ summary: 'Gửi thông báo test' })
    @Get('test') //Using for testing only - Not production
    async testSendNotification(
        @Req() req: Request
    ) {
        const user = (req.user) as any
        return await this.notificationService.testPushNotification(Number(user.id))
    }
}
