import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Req,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express, Request } from 'express';
import { Role } from '@prisma/client';
import { Roles } from '@/bases/decorators/role.decorators';
import { RolesGuard } from '@/bases/guards/role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { VoucherService } from './voucher.service';
import {
    CreateVoucherDto,
    UpdateVoucherDto,
    VoucherListQueryDto,
} from './dto/voucher.dto';

@Controller('vouchers')
export class VoucherController {
    constructor(private readonly voucherService: VoucherService) {}

    @Get()
    async getVouchers(@Query() query: VoucherListQueryDto) {
        return await this.voucherService.getVouchers(query);
    }

    @Get('code/:code')
    async getVoucherByCode(
        @Param('code') code: string,
        @Query('restaurantId') restaurantId?: string,
    ) {
        return await this.voucherService.getVoucherByCode(
            code,
            restaurantId ? Number(restaurantId) : undefined,
        );
    }

    @Get(':id')
    async getVoucherDetail(@Param('id', ParseIntPipe) id: number) {
        return await this.voucherService.getVoucherDetail(id);
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    @UseInterceptors(FileInterceptor('image'))
    async createVoucher(
        @Req() req: Request,
        @Body() data: CreateVoucherDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.voucherService.createVoucher(
            Number(user.id),
            user.roles ?? [],
            data,
            file,
        );
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id')
    @UseInterceptors(FileInterceptor('image'))
    async updateVoucher(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
        @Body() data: UpdateVoucherDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.voucherService.updateVoucher(
            Number(user.id),
            user.roles ?? [],
            id,
            data,
            file,
        );
    }

    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete(':id')
    async endVoucher(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
    ) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.voucherService.endVoucher(
            Number(user.id),
            user.roles ?? [],
            id,
        );
    }
}
