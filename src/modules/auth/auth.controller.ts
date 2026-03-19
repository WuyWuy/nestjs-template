import {
    Body,
    Controller,
    Get,
    // HttpCode,
    // HttpStatus,
    Post,
    Query,
    Req,
    UseGuards,
    // Req,
    // UseGuards,
} from '@nestjs/common';
// import { RegisterData } from './dto/auth.dto';
import { AuthService } from './auth.service';
import { LoginData, RegisterData } from './dto/auth.dto';
import { LocalAuthGuard } from './local-auth.guard';
import type { Request } from 'express';
// import { LocalAuthGuard } from './local-auth.guard';
// import type { Request } from 'express';
// import { Roles } from '@/bases/decorators/role.decorators';
// import { Role } from '@prisma/client';
// import { RolesGuard } from '@/bases/guards/role.guard';
// import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}
    @Post("register") 
    async register(@Body() registerData : RegisterData) 
    {
        const responseData = await this.authService.register(registerData) 
        return responseData
    }
    @Get("verify") 
    async verify(@Query("otp") otp : string) 
    {
        const responseData = await this.authService.verify(otp) 
        return responseData
    }
    @Post("login") 
    @UseGuards(LocalAuthGuard) 
    async login(@Body() loginData : LoginData , @Req() req : Request) 
    {
        const user = req.user as any 
        const responseData = await this.authService.login(user) 
        return responseData
    }
}
