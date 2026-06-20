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
import type { Request } from 'express';
import { Role, PaymentStatus } from '@prisma/client';
import { Roles } from '@/bases/decorators/role.decorators';
import { RolesGuard } from '@/bases/guards/role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminService } from './admin.service';
import {
    AdminResetPasswordDto,
    ApproveRestaurantDto,
    AuditLogQueryDto,
    PaymentAdminQueryDto,
    UpdatePaymentStatusDto,
} from './dto/admin.dto';

@ApiTags('15. Admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @ApiOperation({ summary: 'Xem dashboard admin' })
    @Get('dashboard')
    async getDashboard(@Req() req: Request) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.getDashboardSummary(actorId);
    }

    @ApiOperation({ summary: 'Xem doanh thu admin' })
    @Get('revenue')
    async getRevenue(@Req() req: Request) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.getRevenueSummary(actorId);
    }

    @ApiOperation({ summary: 'Xem audit logs' })
    @Get('audit-logs')
    async getAuditLogs(@Req() req: Request, @Query() query: AuditLogQueryDto) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.getAuditLogs(actorId, query);
    }

    @ApiOperation({ summary: 'Xem danh sách thanh toán admin' })
    @Get('payments')
    async getPayments(
        @Req() req: Request,
        @Query() query: PaymentAdminQueryDto,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.getPayments(actorId, query);
    }

    @ApiOperation({ summary: 'Cập nhật trạng thái thanh toán' })
    @Patch('payments/:paymentId')
    async updatePaymentStatus(
        @Req() req: Request,
        @Param('paymentId', ParseIntPipe) paymentId: number,
        @Body() data: UpdatePaymentStatusDto,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.updatePaymentStatus(
            actorId,
            paymentId,
            data.paymentStatus as PaymentStatus,
        );
    }

    @ApiOperation({ summary: 'Reset mật khẩu user' })
    @Post('users/:userId/reset-password')
    async resetUserPassword(
        @Req() req: Request,
        @Param('userId', ParseIntPipe) userId: number,
        @Body() data: AdminResetPasswordDto,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.resetUserPassword(
            actorId,
            userId,
            data,
        );
    }

    @ApiOperation({ summary: 'Duyệt hoặc từ chối nhà hàng' })
    @Patch('restaurants/:restaurantId/approval')
    async updateRestaurantApproval(
        @Req() req: Request,
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
        @Body() data: ApproveRestaurantDto,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.updateRestaurantApproval(
            actorId,
            restaurantId,
            data.approved,
        );
    }
}
