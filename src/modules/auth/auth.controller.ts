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
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
    ChangePasswordData,
    ForgotPasswordData,
    LoginData,
    RefreshTokenData,
    RegisterData,
    ResetEmailData,
    SocialLoginData,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request } from 'express';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }
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
    async login(@Body() data: LoginData) {
        return await this.authService.loginLocal(data);
    }
    @Get('me')
    @UseGuards(JwtAuthGuard)
    async me(@Req() req: Request) {
        const user = req.user as { id?: number; roles?: string[] };
        return await this.authService.getMe(Number(user.id))
    }
    @Post('/refresh')
    async getAccessToken(@Body() data: RefreshTokenData) {
        return await this.authService.refreshAccessToken(data.refreshToken);
    }
    @Post('change-password')
    async changePassword(@Body() data: ChangePasswordData) {
        return await this.authService.changePassword(data);
    }
    @Post('reset-email')
    @UseGuards(JwtAuthGuard)
    async resetEmail(@Body() data: ResetEmailData) {
        const { phone, password } = data;
        if (!phone || !password) throw new BadRequestException('Invalid body');
        const responseData = await this.authService.changeEmail(
            phone,
            password,
        );
        return responseData;
    }
    @Get('reset-email/verify') //updated-email?email=nguyenkhaan2000@gmail.com&otp=123456
    async verifyChangeEmail(
        @Query('email') email: string,
        @Query('otp') otp: string,
    ) {
        const responseData = await this.authService.verifyChangeEmail(
            email,
            otp,
        );
        return responseData;
    }
    @Post('forgot-password')
    async forgotPassword(@Body() data: ForgotPasswordData) {
        const email = data.email;
        if (!email) throw new BadRequestException('Email invalid');
        const response = await this.authService.forgotPassword(email);
        return response;
    }
    @Post('login-facebook')
    async loginFb(@Body() data: Omit<SocialLoginData, 'provider'>) {
        const accessToken = data.accessToken || data.code;
        if (!accessToken) throw new BadRequestException('invalid access token');
        const response = await this.authService.fbLogin(accessToken);
        return response;
    }
    @Post('login-google')
    async loginGoogle(@Body() data: Omit<SocialLoginData, 'provider'>) {
        const accessToken = data.accessToken || data.code;
        if (!accessToken) throw new BadRequestException('invalid access token');
        return await this.authService.googleLogin(accessToken);
    }
    @Post('login-social')
    async loginSocial(@Body() data: SocialLoginData) {
        const accessToken = data.accessToken || data.code;
        if (!accessToken) throw new BadRequestException('invalid access token');
        if (data.provider === 'facebook') {
            return await this.authService.fbLogin(accessToken);
        }
        return await this.authService.googleLogin(accessToken);
    }
}
