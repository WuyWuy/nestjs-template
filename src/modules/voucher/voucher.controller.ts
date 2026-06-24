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
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('11. Voucher')
@Controller('vouchers')
export class VoucherController {
    constructor(private readonly voucherService: VoucherService) {}

    @ApiOperation({ summary: 'Lấy danh sách voucher theo phạm vi quyền' })
    @Roles(Role.ADMIN, Role.BUSINESS)
    @UseGuards(JwtAuthGuard , RolesGuard)
    @Get()
    async getVouchers(
        @Query() query: VoucherListQueryDto,
        @Req() req : Request
    ) {
        const user = req.user as { id?: number; roles?: string[] };

        return await this.voucherService.getVouchers(
            query,
            Number(user.id),
            user.roles ?? [],
        );
    }

    @ApiOperation({ summary: 'Tra cứu voucher theo mã' })
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
    //Lay danh sach voucher co the dung duoc cho 1 don hang 
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth() 
    @ApiOperation({ summary: 'Lấy danh sách voucher phù hợp với đơn hàng'}) 
    @Get('/suitable/:restaurantId')
    async getApproriateVoucher(
        @Param('restaurantId' , ParseIntPipe) restaurantId : number, 
        @Query('cost') cost? : string  
    ) 
    {
        const parsedCost = cost ? parseInt(cost , 10) : undefined 
        return await this.voucherService.getSuitableVoucher(restaurantId , parsedCost)

    }
    @ApiOperation({ summary: 'Xem chi tiết voucher' })
    @Get(':id')
    async getVoucherDetail(@Param('id', ParseIntPipe) id: number) {
        return await this.voucherService.getVoucherDetail(id);
    }

    @ApiOperation({ summary: 'Tạo voucher mới' })
    @ApiBearerAuth()
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['name', 'code', 'sale', 'type'],
            properties: {
                name: {
                    type: 'string',
                    example: 'Welcome 5',
                },
                code: {
                    type: 'string',
                    example: 'WELCOME5',
                },
                description: {
                    type: 'string',
                    example: 'Flat 5 off for first orders.',
                },
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh voucher',
                },
                sale: {
                    type: 'number',
                    example: 5,
                },
                type: {
                    type: 'string',
                    example: 'MONEY',
                },
                status: {
                    type: 'string',
                    example: 'APPLYING',
                },
                restaurantId: {
                    type: 'number',
                    example: 1,
                },
                minimumOrderAmount: {
                    type: 'number',
                    example: 15,
                },
                maximumDiscountAmount: {
                    type: 'number',
                    example: 50,
                },
                startAt: {
                    type: 'string',
                    example: '2026-06-21T00:00:00.000Z',
                },
                endAt: {
                    type: 'string',
                    example: '2026-07-21T23:59:59.000Z',
                },
            },
        },
    })
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

    @ApiOperation({ summary: 'Cập nhật voucher' })
    @ApiBearerAuth()
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    example: 'Burger Ten',
                },
                code: {
                    type: 'string',
                    example: 'BURGER10',
                },
                description: {
                    type: 'string',
                    example: 'Ten percent off Burger Town orders.',
                },
                image: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh voucher mới',
                },
                sale: {
                    type: 'number',
                    example: 10,
                },
                type: {
                    type: 'string',
                    example: 'PERCENT',
                },
                status: {
                    type: 'string',
                    example: 'APPLYING',
                },
                minimumOrderAmount: {
                    type: 'number',
                    example: 20,
                },
                maximumDiscountAmount: {
                    type: 'number',
                    example: 6,
                },
            },
        },
    })
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

    @ApiOperation({ summary: 'Kết thúc voucher' })
    @ApiBearerAuth()
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
