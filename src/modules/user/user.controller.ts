import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Put,
    Req,
    Query,
    UnauthorizedException,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Express, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import {
    AddUserAddressDto,
    UpdateUserAddressDto,
    UpdateUserProfileDto,
} from './dto/user.dto';

@ApiTags('03. User')
@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}
    @ApiOperation({ summary: 'Upload ảnh dùng cho hồ sơ người dùng' })
    @ApiBearerAuth()
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['data'],
            properties: {
                data: {
                    type: 'string',
                    format: 'binary',
                    description: 'File ảnh hồ sơ cần upload',
                },
            },
        },
    })
    @UseGuards(JwtAuthGuard)
    @Post()
    @UseInterceptors(FileInterceptor('data'))
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        const results = await this.userService.uploadImages(file);
        return results;
    }
    @ApiOperation({ summary: 'Lấy danh sách người dùng, dành cho admin' })
    @ApiBearerAuth()
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get()
    async getAllCustomers() {
        const responseData = await this.userService.getAllUsers();
        return responseData;
    }
    @ApiOperation({ summary: 'Xem hồ sơ của chính mình' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('/profile')
    async getProfile(@Req() req: Request) {
        const id = (req.user as any).id;
        if (!id) throw new UnauthorizedException('Invalid Token'); //Login again
        const responseData = await this.userService.getUserProfile(Number(id));
        return responseData;
    }
    @ApiOperation({ summary: 'Cập nhật hồ sơ cá nhân' })
    @ApiBearerAuth()
    @Roles(Role.CUSTOMER, Role.BUSINESS)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    example: 'Nguyen Van A',
                },
                phone: {
                    type: 'string',
                    example: '0901234567',
                },
                birthday: {
                    type: 'string',
                    example: '2000-01-01',
                },
                avatar: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh đại diện mới',
                },
            },
        },
    })
    @Put('profile')
    @UseInterceptors(FileInterceptor('avatar'))
    async updateUserProfile(
        @Req() req: Request,
        @Body() data: UpdateUserProfileDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        const id = (req.user as any).id;
        if (!id) throw new UnauthorizedException('Invalid Token'); //Login again
        const response = await this.userService.updateUserProfile(
            Number(id),
            data,
            file,
        );
        return response;
    }
    //[CUSTOMER'S ADDRESS API RELATED]
    @ApiOperation({ summary: 'Thêm địa chỉ mới cho người dùng' })
    @ApiBearerAuth()
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBody({
        type: AddUserAddressDto,
        examples: {
            example: {
                summary: 'Thêm địa chỉ giao hàng',
                value: {
                    title: 'Nhà riêng',
                    address: {
                        title: 'Nhà riêng',
                        latitude: 10.776889,
                        longitude: 106.700806,
                        fullText:
                            '123 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City',
                    },
                },
            },
        },
    })
    @Post('address')
    async addUserAddress(
        @Body() addUserAddressData: AddUserAddressDto,
        @Req() req: Request,
    ) {
        const id = (req.user as any).id;
        if (!id || isNaN(id))
            throw new UnauthorizedException('User Not Found or token invalid');
        const responseData = await this.userService.addUserAddress(
            Number(id),
            addUserAddressData,
        );
        return responseData;
    }
    @ApiOperation({ summary: 'Lấy toàn bộ địa chỉ của người dùng' })
    @ApiBearerAuth()
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('address/all')
    async getUserAllAddress(@Req() req: Request) {
        const id = (req.user as any).id;
        if (!id || isNaN(id))
            throw new UnauthorizedException('User Not Found or token invalid');
        const response = await this.userService.getAllAddress(Number(id));
        return response;
    }
    @ApiOperation({ summary: 'Xem chi tiết một địa chỉ của người dùng' })
    @ApiBearerAuth()
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('address/:addressId')
    async getUserAddressById(
        @Param('addressId', ParseIntPipe) addressId: number,
        @Req() req: Request,
    ) {
        const id = (req.user as any).id;
        if (!id || isNaN(id))
            throw new UnauthorizedException('User Not Found or token invalid');
        return await this.userService.getUserAddressById(addressId, Number(id));
    }
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @ApiBody({
        type: UpdateUserAddressDto,
        examples: {
            example: {
                summary: 'Cập nhật địa chỉ giao hàng',
                value: {
                    title: 'Văn phòng',
                    address: {
                        title: 'Văn phòng',
                        latitude: 10.786749,
                        longitude: 106.690529,
                        fullText:
                            '45 Vo Van Tan, Ward 6, District 3, Ho Chi Minh City',
                    },
                },
            },
        },
    })
    @ApiOperation({ summary: 'Cập nhật địa chỉ của người dùng' })
    @Put('/address/:addressId')
    async updateUserAddress(
        @Param('addressId', ParseIntPipe) addressId: number,
        @Body() updateAddressData: UpdateUserAddressDto,
        @Req() req: Request,
    ) {
        const id = (req.user as any).id;
        if (!id || isNaN(id))
            throw new UnauthorizedException('User Not Found or token invalid');
        const response = await this.userService.updateUserAddress(
            addressId,
            Number(id),
            updateAddressData,
        );
        return response;
    }
    @ApiOperation({ summary: 'Xóa địa chỉ của người dùng' })
    @ApiBearerAuth()
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete('address/:addressId')
    async deleteUserAddress(
        @Req() req: Request,
        @Param('addressId', ParseIntPipe) addressId: number,
    ) {
        const id = (req.user as any).id;
        if (!id || isNaN(id))
            throw new UnauthorizedException('User Not Found or token invalid');
        const response = await this.userService.deleteUserAddress(
            addressId,
            Number(id),
        );
        return response;
    }

    @ApiOperation({ summary: 'Lấy danh sách review của tôi (My Reviews)' })
    @ApiBearerAuth()
    @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Số lượng bản ghi tối đa' })
    @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Số bản ghi bỏ qua' })
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('reviews')
    async getMyReviews(
        @Req() req: Request,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
    ) {
        const id = (req.user as any).id;
        if (!id || isNaN(id))
            throw new UnauthorizedException('User Not Found or token invalid');
        const parsedLimit = limit ? Number(limit) : 20;
        const parsedOffset = offset ? Number(offset) : 0;
        const data = await this.userService.getMyReviews(Number(id), parsedLimit, parsedOffset);
        return {
            success: true,
            data,
        };
    }
}
