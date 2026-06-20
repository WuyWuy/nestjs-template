//Save device, remove device, getDevice,
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterDeviceData } from './dto/device.dto';
import { DeviceService } from './device.service';
import type { Request } from 'express';
@ApiBearerAuth()
@ApiTags('03. User')
@Controller('device')
@UseGuards(JwtAuthGuard)
export class DeviceController {
    constructor(private readonly deviceService: DeviceService) {}
    @ApiOperation({ summary: 'Đăng ký device token của người dùng' })
    @Post()
    async register(
        @Body() registerDeviceData: RegisterDeviceData,
        @Req() req: Request,
    ) {
        const id = (req.user as any).id;
        const responseData = await this.deviceService.register(
            id,
            registerDeviceData,
        );
        return responseData;
    }
}
