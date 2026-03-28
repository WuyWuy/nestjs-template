import { PrismaService } from '@/prisma/prisma.service';
import {
    BadRequestException,
    // BadRequestException,
    Injectable,
    // UnauthorizedException,
    // UnauthorizedException,
} from '@nestjs/common';
// import { Role, TokenType } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
// import { TokenBody } from '@/bases/commons/enums/token.enum';
// import { TwilioService } from '../twilio/twilio.service';
import { RegisterData } from './dto/auth.dto';
import { OTPType, Role, TokenType } from '@prisma/client';
import { generateOtp } from '@/utilis/ranomOtp';
import {
    RESET_EMAIL_OTP_LIVE_TIME,
    VERIFY_OTP_LIVE_TIME,
} from '@/bases/commons/constants/auth.constant';
import { hashing } from '@/utilis/sha256';
import { ResponseBody } from '@/bases/commons/enums/response.enum';
import { TokenBody } from '@/bases/commons/enums/token.enum';
import {
    ACCESS_TOKEN_LIVE_TIME,
    REFRESH_TOKEN_LIVE_TIME,
} from '@/bases/commons/constants/jwt.constant';
import { TwilioService } from '../twilio/twilio.service';
import { generatePassword } from '@/utilis/rnadomPassword';
import { EmailService } from '../email/email.service';
import { APP_NAME } from '@/bases/commons/constants/app.constant';

@Injectable()
export class AuthService {
    //this is the simple Authentication. You can config it to suitable for your job
    constructor(
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly twilioService: TwilioService,
        private readonly emailService : EmailService
        // private readonly twilioService: TwilioService,
    ) {}
    async validateUser(phone: string, password: string) {
        //Ham validate user dung de validate nguoi dung khi ho dang nhap
        const user = await this.prismaService.user.findFirst({
            where: { phone, active: true },
        });
        if (user) {
            const results = await Bun.password.verify(password, user.password);
            if (results) return user;
            return null;
        }
        return null;
    }
    async register(registerData: RegisterData) {
        try {
            const results = await this.prismaService.$transaction(
                async (tx) => {
                    let user = await tx.user.findFirst({
                        where: {
                            deleteAt: null,
                            OR: [
                                {
                                    phone: registerData.phone,
                                },
                                {
                                    email: registerData.email,
                                },
                            ],
                        },
                    });
                    if (user && user.active)
                        throw new BadRequestException(
                            'Use has been register. Please login',
                        );
                    if (!user) {
                        const hashedPassword = await Bun.password.hash(
                            registerData.password,
                            {
                                cost: 10,
                                algorithm: 'bcrypt',
                            },
                        );
                        let address = null;
                        if (registerData.addressId) {
                            address = await tx.address.findFirst({
                                where: { id: registerData.addressId },
                            });
                        }
                        user = await tx.user.create({
                            data: {
                                active: false,
                                name: registerData.name,
                                email: registerData.email,
                                birthday: new Date(registerData.birthday),
                                password: hashedPassword,
                                phone: registerData.phone,
                            },
                        });

                        if (user && address) {
                            console.log(address.city);
                            console.log(user.id, address.id);
                            await tx.userAddress.create({
                                data: {
                                    userId: user.id,
                                    addressId: address.id,
                                },
                            });
                        }
                        //Creating Role
                        await tx.userRole.create({
                            data: {
                                userId: user.id,
                                role: Role.CUSTOMER, //Default is the customer
                            },
                        });
                    }
                    //Create otp
                    //Drop any otp related to the user
                    await tx.oTP.deleteMany({
                        where: {
                            userId: user.id,
                            type: OTPType.VERIFY_OTP, //Use for verify register
                        },
                    });
                    const otp = generateOtp();
                    await tx.oTP.create({
                        data: {
                            otp: hashing(otp),
                            userId: user.id,
                            type: OTPType.VERIFY_OTP,
                            expiresAt: new Date(
                                Date.now() + VERIFY_OTP_LIVE_TIME,
                            ),
                        },
                    });

                    return {
                        otp,
                        id: user.id,
                        birthday: user.birthday,
                        name: user.name,
                        phone: user.phone,
                        email: user.email,
                    };
                },
            );
            return results;
        } catch (err) {
            console.log('Register Error: ', err);
            throw err;
        }
    }
    async verify(otp: string) {
        try {
            const hashedOtp = hashing(otp);
            const storeOtp = await this.prismaService.oTP.findFirst({
                where: {
                    otp: hashedOtp,
                    expiresAt: {
                        gte: new Date(),
                    },
                },
            });
            if (!storeOtp) throw new BadRequestException('Invalid Otp Code');
            if (!storeOtp.usedAt) {
                await this.prismaService.user.update({
                    where: {
                        id: storeOtp.userId,
                    },
                    data: {
                        active: true,
                    },
                });
                await this.prismaService.oTP.update({
                    where: {
                        id: storeOtp.id,
                    },
                    data: {
                        usedAt: new Date(),
                    },
                });
                return {
                    [ResponseBody.MESSAGE]: 'Verify Account successfully',
                };
            }
            throw new BadRequestException('User has been verified');
        } catch (err) {
            console.log('Verify Account Error: ', err);
            throw err;
        }
    }
    async login(user: any) {
        try {
            const userRoles = await this.prismaService.userRole.findMany({
                where: {
                    userId: user.id,
                },
                select: {
                    role: true,
                },
            });
            const payload = {
                [TokenBody.EMAIL]: user.email,
                [TokenBody.SUB]: user.id,
                [TokenBody.ROLES]: userRoles.map((roleItem) => roleItem.role),
            };
            const accessSecretKey =
                this.configService.get<string>('ACCESS_SECRET_KEY');
            const refreshSecretKey =
                this.configService.get<string>('REFRESH_SECRET_KEY');

            const accessToken = await this.jwtService.signAsync(
                { ...payload, [TokenBody.PURPOSE]: TokenType.ACCESS },
                {
                    secret: accessSecretKey,
                    expiresIn: ACCESS_TOKEN_LIVE_TIME,
                },
            );
            const refreshToken = await this.jwtService.signAsync(
                { ...payload, [TokenBody.PURPOSE]: TokenType.REFRESH },
                {
                    secret: refreshSecretKey,
                    expiresIn: REFRESH_TOKEN_LIVE_TIME,
                },
            );
            //Delete old and store new token
            return {
                accessToken,
                refreshToken,
            };
        } catch (err) {
            console.log('Login error: ', err);
            throw err;
        }
    }
    async changeEmail(phone: string, password: string) {
        try {
            const user = await this.prismaService.user.findFirst({
                where: { phone },
            });
            console.log(user) 
            if (!user) throw new BadRequestException('User Not Found');
            if (phone.startsWith('0')) {
                phone = phone.replace('0', '84');
            }
            const result = await Bun.password.verify(password, user.password);
            if (!result) throw new BadRequestException('Wrong Password');
            const otp = generateOtp();
            const hashOtp = hashing(otp);
            //Calling twilio
            await this.prismaService.oTP.create({
                data: {
                    otp: hashOtp,
                    type: OTPType.RESET_EMAIL_OTP,
                    expiresAt: new Date(Date.now() + RESET_EMAIL_OTP_LIVE_TIME),
                    userId: user.id,
                },
            });
            await this.twilioService.sendSms(phone, otp);
            console.log('OTP da gui: ', otp);
            return {
                otp,
            };
        } catch (err) {
            console.log('Change email error: ', err);
            throw err;
        }
    }
    async verifyChangeEmail(email: string, otp: string) {
        try {
            const hashedOtp = hashing(otp);
            const existsOtp = await this.prismaService.oTP.findFirst({
                where: {
                    otp: hashedOtp,
                    type: OTPType.RESET_EMAIL_OTP,
                    usedAt: null,
                },
            });
            if (!existsOtp) throw new BadRequestException('OTP Invalid');
            if (existsOtp.expiresAt < new Date())
                throw new BadRequestException('OTP has been expired');
            await this.prismaService.user.update({
                data: { email },
                where: {
                    id: existsOtp.userId,
                },
            });
            return {
                message: 'Email has been updated',
            };
        } catch (err) {
            console.log('Update email error', err);
            throw err;
        }
    }
    async forgotPassword(email : string) 
    {
        try 
        {
            const user = await this.prismaService.user.findFirst({
                where: {
                    email 
                }
            }) 
            if (!user) 
                throw new BadRequestException("Email has not been registered") 
            const defaultPassword = generatePassword() 
            const hashPassword = await Bun.password.hash(
                defaultPassword , {
                    cost : 10, 
                    algorithm : 'bcrypt'
                }
            ) 
            await this.prismaService.user.update({
                data: {
                    password : hashPassword
                }, 
                where: {
                    id : user.id 
                }
            })
            //send email 
            await this.emailService.forgotPasswordEmail(`[${APP_NAME}] RESET YOUR PASSWORD` , user.email , defaultPassword) 
            console.log("Email has been sent successfully") 
            return {
                defaultPassword 
            }
        } 
        catch (err) 
        {
            console.log("Reset password to default error" , err) 
            throw err 
        }

    }
}
