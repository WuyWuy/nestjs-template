import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { HomeService } from './home.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { GetDashboardQueryDto } from './dto/home.dto';

@ApiTags('12. Home')
@Controller('home')
export class HomeController {
    constructor(private readonly homeService: HomeService) {}

    @ApiOperation({ summary: 'Lấy số lượng cart items và tin nhắn chưa đọc' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('counters')
    async getCounters(@Req() req: Request) {
        const userId = Number((req.user as { id: number }).id);
        return await this.homeService.getCounters(userId);
    }

    @ApiOperation({ summary: 'Lấy thông tin dashboard hợp nhất cho trang chủ' })
    @UseGuards(OptionalJwtAuthGuard)
    @Get('dashboard')
    async getDashboard(@Query() query: GetDashboardQueryDto, @Req() req: Request) {
        const userId = (req.user as { id?: number })?.id ? Number((req.user as { id?: number })?.id) : undefined;
        return await this.homeService.getDashboard(query.lat, query.lng, userId);
    }
}
