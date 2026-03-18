import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { RegisterData } from './dto/auth.dto';
import { Role, TokenType } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenBody } from '@/bases/commons/enums/token.enum';

@Injectable()
export class AuthService {
    //this is the simple Authentication. You can config it to suitable for your job
    constructor(
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
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
    async register(data: RegisterData) {
        try {
            let user = await this.prismaService.user.findFirst({
                where: { email: data.email },
            });
            if (user && user.active)
                throw new BadRequestException('User Has Been Registered');
            if (user == null) {
                //Neu user la    null thi  ao user moi
                const hashedPassword = await Bun.password.hash(data.password, {
                    cost: 10,
                    algorithm: 'bcrypt',
                });
                user = await this.prismaService.user.create({
                    data: {
                        email: data.email,
                        password: hashedPassword,
                        name: 'Admin',
                        active: true,
                    },
                });
                //Gan role cho nguoi dung
                await this.prismaService.userRole.create({
                    data: {
                        userID: user.id,
                        role: Role.USER,
                    },
                });
            }
            //tien hanh gui duoing maii verify
            //Tien hanh verify tai khoan o day
            return {
                id: user.id,
                email: user.email,
                name: user.name,
            };
        } catch (e) {
            if (e instanceof BadRequestException) throw e;
            throw e;
        }
    }
    async login(email: string, password: string) {
        try {
            const user = await this.prismaService.user.findFirst({
                where: { email },
            });
            if (user == null)
                throw new UnauthorizedException('User Has Not Registered');
            const accessSecretKey: string =
                this.configService.get<string>('ACCESS_SECRET') || '';
            const refreshSecretKey: string =
                this.configService.get<string>('REFRESH_SECRET') || '';
            //--- Verify Password ---
            const results = await Bun.password.verify(password, user.password);
            if (!results) throw new BadRequestException('Wrong Password');
            //--- Access Token ---
            const accessToken = this.jwtService.sign(
                {
                    [TokenBody.EMAIL]: email,
                    [TokenBody.PURPOSE]: TokenType.ACCESS,
                    [TokenBody.SUB]: user.id,
                    [TokenBody.ROLES]: [Role.USER], //Chinh thaynh lay role that su cua nguoi dung
                },
                {
                    secret: accessSecretKey,
                    expiresIn: '15m', //Best Practice: Change to jwt constant
                },
            );

            //--- Refresh Token ---
            const refreshToken = this.jwtService.sign(
                {
                    [TokenBody.EMAIL]: email,
                    [TokenBody.PURPOSE]: TokenType.ACCESS,
                    [TokenBody.SUB]: user.id,
                    [TokenBody.ROLES]: Role.USER, //Chinh thaynh lay role that su cua nguoi dung
                },
                {
                    secret: refreshSecretKey,
                    expiresIn: '14d',
                },
            );
            return {
                email,
                access_token: accessToken,
                refresh_token: refreshToken,
            };
        } catch (err) {
            if (err instanceof UnauthorizedException) throw err;
            throw err;
        }
    }
}
