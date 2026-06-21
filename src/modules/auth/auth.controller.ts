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
    ResetPasswordData,
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
    @ApiBody({
        type: LoginData,
        examples: {
            example: {
                summary: 'Đăng nhập hợp lệ',
                value: {
                    phone: '0901234567',
                    password: '123456',
                },
            },
        },
    })
    @Post('login')
    async login(@Body() data: LoginData) {
        return await this.authService.loginLocal(data);
    }

    @ApiOperation({ summary: 'Đổi refresh token lấy access token mới' })
    @ApiBody({
        type: RefreshTokenData,
        examples: {
            example: {
                summary: 'Refresh token hợp lệ',
                value: {
                    refreshToken:
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.refresh.token',
                },
            },
        },
    })
    @Post('/refresh')
    async getAccessToken(@Body() data: RefreshTokenData) {
        return await this.authService.refreshAccessToken(data.refreshToken);
    }
    @ApiOperation({ summary: 'Đổi mật khẩu bằng email và và mật khẩu cũ' })
    @ApiBody({
        type: ChangePasswordData,
        examples: {
            byEmail: {
                summary: 'Đổi mật khẩu bằng email',
                value: {
                    email: 'user@example.com',
                    currentPassword: '123456',
                    newPassword: '1234567',
                },
            },
            byPhone: {
                summary: 'Đổi mật khẩu bằng số điện thoại',
                value: {
                    phone: '0901234567',
                    currentPassword: '123456',
                    newPassword: '1234567',
                },
            },
        },
    })
    @Post('change-password')
    async changePassword(@Body() data: ChangePasswordData) {
        return await this.authService.changePassword(data);
    }
    @ApiOperation({ summary: 'Bắt đầu luồng đổi email' })
    @ApiBody({
        type: ResetEmailData,
        examples: {
            example: {
                summary: 'Yêu cầu OTP đổi email',
                value: {
                    phone: '0901234567',
                    password: '123456',
                },
            },
        },
    })
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
    @ApiBody({
        type: ForgotPasswordData,
        examples: {
            example: {
                summary: 'Nhận OTP đặt lại mật khẩu',
                value: {
                    email: 'user@example.com',
                },
            },
        },
    })
    @Post('forgot-password')
    async forgotPassword(@Body() data: ForgotPasswordData) {
        const email = data.email;
        if (!email) throw new BadRequestException('Email invalid');
        const response = await this.authService.forgotPassword(email);
        return response;
    }
    @ApiOperation({ summary: 'Đặt lại mật khẩu bằng OTP' })
    @ApiBody({
        type: ResetPasswordData,
        examples: {
            example: {
                summary: 'Đặt lại mật khẩu với OTP',
                value: {
                    email: 'user@example.com',
                    otp: '123456',
                    newPassword: '1234567',
                },
            },
        },
    })
    @Post('reset-password')
    async resetPassword(@Body() data: ResetPasswordData) {
        return await this.authService.resetPassword(data);
    }
    @ApiOperation({ summary: 'Đăng nhập bằng Facebook' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                accessToken: {
                    type: 'string',
                    example: 'facebook-access-token',
                },
                code: {
                    type: 'string',
                    example: 'facebook-authorization-code',
                },
            },
        },
        examples: {
            accessToken: {
                summary: 'Đăng nhập bằng access token',
                value: {
                    accessToken: 'facebook-access-token',
                },
            },
            code: {
                summary: 'Đăng nhập bằng authorization code',
                value: {
                    code: 'facebook-authorization-code',
                },
            },
        },
    })
    @Post('login-facebook')
    async loginFb(@Body() data: Omit<SocialLoginData, 'provider'>) {
        const accessToken = data.accessToken || data.code;
        if (!accessToken) throw new BadRequestException('invalid access token');
        const response = await this.authService.fbLogin(accessToken);
        return response;
    }
    @ApiOperation({ summary: 'Đăng nhập bằng Google' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                accessToken: {
                    type: 'string',
                    example: 'ya29.a0AfH6SMC-example-token',
                },
                code: {
                    type: 'string',
                    example: '4/0AbUR2V-example-code',
                },
            },
        },
        examples: {
            accessToken: {
                summary: 'Đăng nhập bằng access token',
                value: {
                    accessToken: 'ya29.a0AfH6SMC-example-token',
                },
            },
            code: {
                summary: 'Đăng nhập bằng authorization code',
                value: {
                    code: '4/0AbUR2V-example-code',
                },
            },
        },
    })
    @Post('login-google')
    async loginGoogle(@Body() data: Omit<SocialLoginData, 'provider'>) {
        const accessToken = data.accessToken || data.code;
        if (!accessToken) throw new BadRequestException('invalid access token');
        return await this.authService.googleLogin(accessToken);
    }
    @ApiOperation({ summary: 'Đăng nhập social theo provider' })
    @ApiBody({
        type: SocialLoginData,
        examples: {
            google: {
                summary: 'Đăng nhập Google',
                value: {
                    provider: 'google',
                    accessToken: 'ya29.a0AfH6SMC-example-token',
                },
            },
            facebook: {
                summary: 'Đăng nhập Facebook',
                value: {
                    provider: 'facebook',
                    accessToken: 'facebook-access-token',
                },
            },
        },
    })
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
