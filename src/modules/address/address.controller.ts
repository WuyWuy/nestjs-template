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
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import type { Request } from 'express';
import { Roles } from '@/bases/decorators/role.decorators';
import { RolesGuard } from '@/bases/guards/role.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
    AddressListQueryDto,
    CreateAddressDto,
    FindAddressDto,
    UpdateAddressDto,
} from './dto/address.dto';
import { AddressService } from './address.service';

@ApiTags('04. Address')
@Controller('address')
export class AddressController {
    constructor(private readonly addressService: AddressService) {}
    
    @ApiOperation({ summary: 'Tạo địa chỉ mới' })
    @ApiBody({
        type: CreateAddressDto,
        examples: {
            example: {
                summary: 'Địa chỉ tại TP.HCM',
                value: {
                    title: 'Nhà riêng',
                    latitude: 10.776889,
                    longitude: 106.700806,
                    fullText: '123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City',
                },
            },
        },
    })
    @Post()
    async createAddress(@Body() createAddressData: CreateAddressDto) {
        return await this.addressService.createAddress(createAddressData);
    }

    // @Roles(Role.ADMIN)
    // @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiOperation({ summary: 'Lấy danh sách địa chỉ' })
    @Get()
    async getAllAddresses(@Query() query: AddressListQueryDto) {
        return await this.addressService.getAllAddresses(query);
    }

    // @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tìm địa chỉ theo từ khóa' })
    @Get('search')
    async findAddresses(@Query() query: FindAddressDto) {
        return await this.addressService.findAddresses(query);
    }

    // @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Xem chi tiết địa chỉ' })
    @Get(':addressId')
    async getAddressDetail(
        @Param('addressId', ParseIntPipe) addressId: number,
    ) {
        return await this.addressService.getAddressDetail(addressId);
    }

    @ApiOperation({ summary: 'Cập nhật địa chỉ' })
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard , RolesGuard)
    @ApiBearerAuth()
    @ApiBody({
        type: UpdateAddressDto,
        examples: {
            example: {
                summary: 'Cập nhật địa chỉ',
                value: {
                    title: 'Văn phòng',
                    latitude: 10.786749,
                    longitude: 106.690529,
                    fullText: '45 Vo Van Tan, Ward 6, District 3, Ho Chi Minh City',
                },
            },
        },
    })
    @Patch(':addressId')
    async updateAddress(
        @Req() req: Request,
        @Param('addressId', ParseIntPipe) addressId: number,
        @Body() data: UpdateAddressDto,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.addressService.updateAddress(actorId, addressId, data);
    }

    @ApiOperation({ summary: 'Xóa địa chỉ' })
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBearerAuth()
    @Delete(':addressId')
    async deleteAddress(
        @Req() req: Request,
        @Param('addressId', ParseIntPipe) addressId: number,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.addressService.deleteAddress(actorId, addressId);
    }
}
