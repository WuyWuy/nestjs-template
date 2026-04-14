import {
    Body,
    Controller,
    Get,
    Post,
    Put,
    Req,
    UnauthorizedException,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import type { Express, Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import { AddUserAddressDto, UpdateUserProfileDto } from './dto/user.dto';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}
    @Post()
    @UseInterceptors(FileInterceptor('data'))
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        const results = await this.userService.uploadImages(file);
        return results;
    }
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get()
    async getAllCustomers() {
        const responseData = await this.userService.getAllUsers();
        return responseData;
    }
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('/profile')
    async getProfile(@Req() req: Request) {
        const id = (req.user as any).id;
        if (!id) throw new UnauthorizedException('Invalid Token'); //Login again
        const responseData = await this.userService.getUserProfile(Number(id));
        return responseData;
    }
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Put('profile')
    @UseInterceptors(FileInterceptor('avatar'))
    async updateUserProfile(
        @Req() req : Request, 
        @Body() data : UpdateUserProfileDto, 
        @UploadedFile() file : Express.Multer.File
    ) {
        const id = (req.user as any).id;
        if (!id) throw new UnauthorizedException('Invalid Token'); //Login again
        const response = await this.userService.updateUserProfile(Number(id) , data , file) 
        return response
    }
    //[CUSTOMER'S ADDRESS API RELATED]
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('address')
    async addCustomerAddress(
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
    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('address/all')
    async getCustomerAddress(@Req() req: Request) {
        const id = (req.user as any).id;
        if (!id || isNaN(id))
            throw new UnauthorizedException('User Not Found or token invalid');
        const response = await this.userService.getAllAddress(Number(id));
        return response;
    }
}
