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

@Controller('admin')
@Roles(Role.ADMIN)
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get('dashboard')
    async getDashboard(@Req() req: Request) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.getDashboardSummary(actorId);
    }

    @Get('revenue')
    async getRevenue(@Req() req: Request) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.getRevenueSummary(actorId);
    }

    @Get('audit-logs')
    async getAuditLogs(@Req() req: Request, @Query() query: AuditLogQueryDto) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.getAuditLogs(actorId, query);
    }

    @Get('payments')
    async getPayments(
        @Req() req: Request,
        @Query() query: PaymentAdminQueryDto,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.adminService.getPayments(actorId, query);
    }

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
