import { PrismaService } from '@/prisma/prisma.service';
import {
    // BadRequestException,
    Injectable,
    // UnauthorizedException,
} from '@nestjs/common';
// import { RegisterData } from './dto/auth.dto';
// import { Role, TokenType } from '@prisma/client';
// import { JwtService } from '@nestjs/jwt';
// import { ConfigService } from '@nestjs/config';
// import { TokenBody } from '@/bases/commons/enums/token.enum';
import { TwilioService } from '../twilio/twilio.service';

@Injectable()
export class AuthService {
    //this is the simple Authentication. You can config it to suitable for your job
    constructor(
        private readonly prismaService: PrismaService,
        // private readonly jwtService: JwtService,
        // private readonly configService: ConfigService,
        private readonly twilioService: TwilioService,
    ) {}
    async validateUser(email: string, password: string) {
        //Ham validate user dung de validate nguoi dung khi ho dang nhap
        const user = await this.prismaService.user.findFirst({
            where: { email },
        });
        if (user) {
            const results = await Bun.password.verify(password, user.password);
            if (results) return user;
            return null;
        }
        return null;
    }
    async sendOtp(phone: string) {
        try {
            const result = await this.twilioService.sendSms(
                phone,
                'Cloudian I love you testing message',
            );
            return result;
        } catch (err) {
            console.log('Send otp error: ', err);
            throw err;
        }
    }
}
