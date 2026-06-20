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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('02. Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @ApiBody({
        description:
            'Nhập đầy đủ email, mật khẩu, số điện thoại, ngày sinh và họ tên để tạo tài khoản mới.',
        type: RegisterData,
        examples: {
            example: {
                summary: 'Dữ liệu đăng ký hợp lệ',
                value: {
                    email: 'user@example.com',
                    password: '123456',
                    phone: '0901234567',
                    birthday: '2000-01-01',
                    name: 'Nguyen Van A',
                },
            },
        },
    })
    @ApiOperation({ summary: 'Đăng ký tài khoản mới' })
    @Post('register')
    async register(@Body() registerData: RegisterData) {
        const responseData = await this.authService.register(registerData);
        return responseData;
    }
    @ApiOperation({ summary: 'Xác minh OTP đăng ký' })
    @Get('verify')
    async verify(@Query('otp') otp: string) {
        const responseData = await this.authService.verify(otp);
        return responseData;
    }
    @ApiOperation({ summary: 'Đăng nhập bằng số điện thoại' })
    @Post('login')
    async login(@Body() data: LoginData) {
        return await this.authService.loginLocal(data);
    }

    @ApiOperation({ summary: 'Đổi refresh token lấy access token mới' })
    @Post('/refresh')
    async getAccessToken(@Body() data: RefreshTokenData) {
        return await this.authService.refreshAccessToken(data.refreshToken);
    }
    @ApiOperation({ summary: 'Đổi mật khẩu' })
    @Post('change-password')
    async changePassword(@Body() data: ChangePasswordData) {
        return await this.authService.changePassword(data);
    }
    @ApiOperation({ summary: 'Bắt đầu luồng đổi email' })
    @Post('reset-email')
    @ApiBearerAuth()
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
    @ApiOperation({ summary: 'Xác minh email mới bằng OTP' })
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
    @ApiOperation({ summary: 'Bắt đầu luồng quên mật khẩu' })
    @Post('forgot-password')
    async forgotPassword(@Body() data: ForgotPasswordData) {
        const email = data.email;
        if (!email) throw new BadRequestException('Email invalid');
        const response = await this.authService.forgotPassword(email);
        return response;
    }
    @ApiOperation({ summary: 'Đăng nhập bằng Facebook' })
    @Post('login-facebook')
    async loginFb(@Body() data: Omit<SocialLoginData, 'provider'>) {
        const accessToken = data.accessToken || data.code;
        if (!accessToken) throw new BadRequestException('invalid access token');
        const response = await this.authService.fbLogin(accessToken);
        return response;
    }
    @ApiOperation({ summary: 'Đăng nhập bằng Google' })
    @Post('login-google')
    async loginGoogle(@Body() data: Omit<SocialLoginData, 'provider'>) {
        const accessToken = data.accessToken || data.code;
        if (!accessToken) throw new BadRequestException('invalid access token');
        return await this.authService.googleLogin(accessToken);
    }
    @ApiOperation({ summary: 'Đăng nhập social theo provider' })
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
