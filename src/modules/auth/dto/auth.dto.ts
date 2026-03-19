import {
    IsEmail,
    IsString,
    IsNotEmpty,
    MinLength,
    IsOptional,
    Matches,
    IsDateString,
} from 'class-validator';

export class RegisterData {
    @IsNotEmpty()
    @IsEmail({}, { message: 'Must be valid email' })
    email: string;

    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password: string;
    @IsString()
    @Matches(/^0\d{9,10}$/, {
        message:
            'Phone number must start with 0 and contain 10-11 digits (e.g., 0901234567)',
    })
    phone: string;
    @IsDateString({}, { message: 'Birthday must be a valid ISO date string' })
    birthday: string;
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    addressId?: number;
}
export class LoginData {
    @IsString()
    @MinLength(6, { message: 'Password must be at least 6 characters' })
    password: string;

    @Matches(/^0\d{9,10}$/, {
        message:
            'Phone number must start with 0 and contain 10-11 digits (e.g., 0901234567)',
    })
    phone: string;
}
