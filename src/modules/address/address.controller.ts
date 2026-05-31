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

@Controller('address')
export class AddressController {
    constructor(private readonly addressService: AddressService) {}
    
    @Post()
    async createAddress(@Body() createAddressData: CreateAddressDto) {
        return await this.addressService.createAddress(createAddressData);
    }

    // @Roles(Role.ADMIN)
    // @UseGuards(JwtAuthGuard, RolesGuard)
    @Get()
    async getAllAddresses(@Query() query: AddressListQueryDto) {
        return await this.addressService.getAllAddresses(query);
    }

    // @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard)
    @Get('search')
    async findAddresses(@Query() query: FindAddressDto) {
        return await this.addressService.findAddresses(query);
    }

    // @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard)
    @Get(':addressId')
    async getAddressDetail(
        @Param('addressId', ParseIntPipe) addressId: number,
    ) {
        return await this.addressService.getAddressDetail(addressId);
    }

    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard , RolesGuard)
    @Patch(':addressId')
    async updateAddress(
        @Req() req: Request,
        @Param('addressId', ParseIntPipe) addressId: number,
        @Body() data: UpdateAddressDto,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.addressService.updateAddress(actorId, addressId, data);
    }

    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete(':addressId')
    async deleteAddress(
        @Req() req: Request,
        @Param('addressId', ParseIntPipe) addressId: number,
    ) {
        const actorId = Number((req.user as { id?: number })?.id);
        return await this.addressService.deleteAddress(actorId, addressId);
    }
}
