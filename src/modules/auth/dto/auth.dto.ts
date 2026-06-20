import {
    IsEmail,
    IsIn,
    IsString,
    IsNotEmpty,
    MinLength,
    Matches,
    IsDateString,
    IsOptional,
    ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterData {
    @ApiProperty({
        description: 'Email dùng để đăng ký và đăng nhập',
        example: 'user@example.com',
    })
    @IsNotEmpty()
    @IsEmail({}, { message: 'Must be valid email' })
    email: string;

    @ApiProperty({
        description: 'Mật khẩu tối thiểu 6 ký tự',
        example: '123456',
    })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password: string;

    @ApiProperty({
        description: 'Số điện thoại bắt đầu bằng 0, gồm 10-11 chữ số',
        example: '0901234567',
    })
    @IsString()
    @Matches(/^0\d{9,10}$/, {
        message:
            'Phone number must start with 0 and contain 10-11 digits (e.g., 0901234567)',
    })
    phone: string;

    @ApiProperty({
        description: 'Ngày sinh theo định dạng ISO 8601',
        example: '2000-01-01',
    })
    @IsDateString({}, { message: 'Birthday must be a valid ISO date string' })
    birthday: string;

    @ApiProperty({
        description: 'Họ và tên hiển thị trên hệ thống',
        example: 'Nguyen Van A',
    })
    @IsString()
    @IsNotEmpty()
    name: string;
}
export class LoginData {
    @ApiProperty({
        description: 'Mật khẩu của tài khoản',
        example: '123456',
    })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password: string;

    @ApiProperty({
        description: 'Số điện thoại dùng để đăng nhập',
        example: '0901234567',
    })
    @Matches(/^0\d{9,10}$/, {
        message:
            'Phone number must start with 0 and contain 10-11 digits (e.g., 0901234567)',
    })
    phone: string;
}

export class ResetEmailData {
    @ApiProperty({
        description: 'Mật khẩu hiện tại để xác thực yêu cầu đổi email',
        example: '123456',
    })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password: string;

    @ApiProperty({
        description: 'Số điện thoại của tài khoản',
        example: '0901234567',
    })
    @Matches(/^0\d{9,10}$/, {
        message:
            'Phone number must start with 0 and contain 10-11 digits (e.g., 0901234567)',
    })
    phone: string;
}

export class ForgotPasswordData {
    @ApiProperty({
        description: 'Email để nhận liên kết hoặc OTP khôi phục mật khẩu',
        example: 'user@example.com',
    })
    @IsNotEmpty()
    @IsEmail({}, { message: 'Must be valid email' })
    email: string;
}

export class RefreshTokenData {
    @ApiProperty({
        description: 'Refresh token nhận được sau khi đăng nhập',
        example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example.refresh.token',
    })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;
}

export class ChangePasswordData {
    @ApiPropertyOptional({
        description: 'Email của tài khoản, dùng thay cho phone nếu muốn',
        example: 'user@example.com',
    })
    @IsOptional()
    @ValidateIf((data) => !data.phone)
    @IsEmail({}, { message: 'Must be valid email' })
    email?: string;

    @ApiPropertyOptional({
        description: 'Số điện thoại của tài khoản, dùng thay cho email nếu muốn',
        example: '0901234567',
    })
    @IsOptional()
    @ValidateIf((data) => !data.email)
    @Matches(/^0\d{9,10}$/, {
        message:
            'Phone number must start with 0 and contain 10-11 digits (e.g., 0901234567)',
    })
    phone?: string;

    @ApiProperty({
        description: 'Mật khẩu hiện tại',
        example: '123456',
    })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    currentPassword: string;

    @ApiProperty({
        description: 'Mật khẩu mới',
        example: '1234567',
    })
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    newPassword: string;
}

export class SocialLoginData {
    @ApiProperty({
        description: 'Nhà cung cấp đăng nhập social',
        example: 'google',
    })
    @IsString()
    @IsNotEmpty()
    @IsIn(['facebook', 'google'])
    provider: 'facebook' | 'google';

    @ApiPropertyOptional({
        description: 'Access token của social provider',
        example: 'ya29.a0AfH6SMC-example-token',
    })
    @IsOptional()
    @IsString()
    accessToken?: string;

    @ApiPropertyOptional({
        description: 'Authorization code của social provider',
        example: '4/0AbUR2V-example-code',
    })
    @IsOptional()
    @IsString()
    code?: string;
}
