import {
    BadRequestException,
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
import { RegisterData } from './dto/auth.dto';
import { LocalAuthGuard } from './local-auth.guard';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';
// import { LocalAuthGuard } from './local-auth.guard';
// import type { Request } from 'express';
// import { Roles } from '@/bases/decorators/role.decorators';
// import { Role } from '@prisma/client';
// import { RolesGuard } from '@/bases/guards/role.guard';
// import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}
    @Post('register')
    async register(@Body() registerData: RegisterData) {
        const responseData = await this.authService.register(registerData);
        return responseData;
    }
    @Get('verify')
    async verify(@Query('otp') otp: string) {
        const responseData = await this.authService.verify(otp);
        return responseData;
    }
    @Post('login')
    @UseGuards(LocalAuthGuard)
    async login(@Req() req: Request) {
        const user = req.user as any;
        const responseData = await this.authService.login(user);
        return responseData;
    }
    @Post("reset-email") 
    @UseGuards(JwtAuthGuard)
    async resetEmail(
        @Req() req : Request 
    )
    {
        const {phone , password } = req.body 
        if (!phone || !password) 
            throw new BadRequestException("Invalid body") 
        const responseData = await this.authService.changeEmail(phone , password) 
        return responseData
    } 
    @Get("reset-email/verify")   //updated-email?email=nguyenkhaan2000@gmail.com&otp=123456
    async verifyChangeEmail(
        @Query('email') email : string, 
        @Query('otp') otp : string 
    ) 
    {
        const responseData = await this.authService.verifyChangeEmail(email , otp) 
        return responseData 
    }
    @Post("forgot-password") 
    async forgotPassword(
        @Body() data : { email : string }
    )
    {
        const email = data.email 
        if (!email) 
            throw new BadRequestException("Email invalid") 
        const response = await this.authService.forgotPassword(email) 
        return response
    }
    @Post("login-facebook") 
    async loginFb(@Req() req : Request) 
    {
        const code = req.body.code 
        if (!code) 
            throw new BadRequestException("invalid code") 
        const response = await this.authService.fbLogin(code) 
        return response
    }
}
