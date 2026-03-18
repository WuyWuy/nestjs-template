import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
export class RegisterData {
    @IsNotEmpty()
    @IsEmail({}, { message: 'Must be valid' })
    @IsString()
    email: string;
    @IsString()
    password: string;
}
export class LoginData {
    @IsEmail()
    @IsString()
    email: string;
    @IsString()
    password: string;
}
