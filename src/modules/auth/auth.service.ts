import { PrismaService } from '@/prisma/prisma.service';
import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
    ChangePasswordData,
    LoginData,
    RegisterData,
} from './dto/auth.dto';
import { AuthProvider, OTPType, Role, TokenType } from '@prisma/client';
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
import axios from 'axios';
import { TransactionClientExtended } from '@/prisma/custom-prisma-client';

type SocialProfile = {
    provider: AuthProvider;
    providerUserId: string;
    accessToken: string;
    email?: string;
    name: string;
    avatar: string;
};

type AuthPayload = {
    [TokenBody.EMAIL]: string;
    [TokenBody.SUB]: number;
    [TokenBody.ROLES]: Role[];
};

@Injectable()
export class AuthService {
    //this is the simple Authentication. You can config it to suitable for your job
    constructor(
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly twilioService: TwilioService,
        private readonly emailService: EmailService,
        // private readonly twilioService: TwilioService,
    ) {}
    async validateUser(identifier: string, password: string) {
        const user = await this.prismaService.user.findFirst({
            where: {
                active: true,
                OR: [{ phone: identifier }, { email: identifier }],
            },
        });
        if (!user) return null;

        const isValid = await this.verifyPassword(password, user.password);
        if (!isValid) return null;

        await this.prismaService.identity.upsert({
            where: {
                userId_provider: {
                    userId: user.id,
                    provider: AuthProvider.LOCAL,
                },
            },
            create: {
                userId: user.id,
                provider: AuthProvider.LOCAL,
                providerUserId: this.getLocalProviderUserId(user.id),
            },
            update: {},
        });

        return user;
    }

    private async verifyPassword(plain: string, hash: string): Promise<boolean> {
        try {
            if (typeof Bun !== 'undefined' && Bun?.password && Bun.password.verify) {
                return await Bun.password.verify(plain, hash);
            }
        } catch (e) {
            // fall through to fallback
        }

        try {
            const bcrypt = await import('bcryptjs');
            return await bcrypt.compare(plain, hash);
        } catch (err) {
            console.warn('Password verification fallback failed:', err);
            return false;
        }
    }
    async register(registerData: RegisterData) {
        try {
            const results = await this.prismaService.transaction(async (tx) => {
                let user = await tx.user.findFirst({
                    where: {
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
                    //Creating Role
                    await tx.userRole.create({
                        data: {
                            userId: user.id,
                            role: Role.CUSTOMER, //Default is the customer
                        },
                    });
                    await tx.identity.create({
                        data: {
                            userId: user.id,
                            provider: AuthProvider.LOCAL,
                            providerUserId: this.getLocalProviderUserId(
                                user.id,
                            ),
                        },
                    });
                    //Create a new cart
                    await tx.cart.create({
                        data: {
                            userId: user.id,
                        },
                    });
                } else {
                    await tx.identity.upsert({
                        where: {
                            userId_provider: {
                                userId: user.id,
                                provider: AuthProvider.LOCAL,
                            },
                        },
                        create: {
                            userId: user.id,
                            provider: AuthProvider.LOCAL,
                            providerUserId: this.getLocalProviderUserId(
                                user.id,
                            ),
                        },
                        update: {},
                    });
                }
                //Create otp
                await tx.oTP.deleteMany({
                    userId: user.id,
                    type: OTPType.VERIFY_OTP, //Use for verify register
                });
                const otp = generateOtp();
                await tx.oTP.create({
                    data: {
                        otp: hashing(otp),
                        userId: user.id,
                        type: OTPType.VERIFY_OTP,
                        expiresAt: new Date(Date.now() + VERIFY_OTP_LIVE_TIME),
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
            });
            return results;
        } catch (err) {
            console.log('Register Error: ', err);
            throw err;
        }
    }
    async verify(otp: string) {
        try {
            const hashedOtp = hashing(otp);
            const storeOtp = await this.prismaService.client.oTP.findFirst({
                where: {
                    otp: hashedOtp,
                    expiresAt: {
                        gte: new Date(),
                    },
                },
            });
            if (!storeOtp) throw new BadRequestException('Invalid Otp Code');
            if (!storeOtp.usedAt) {
                await this.prismaService.client.user.update({
                    where: {
                        id: storeOtp.userId,
                    },
                    data: {
                        active: true,
                    },
                });
                await this.prismaService.client.oTP.update({
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
            return await this.buildAuthResponse(user.id);
        } catch (err) {
            console.log('Login error: ', err);
            throw err;
        }
    }
    async loginLocal(data: LoginData) {
        const user = await this.validateUser(data.phone, data.password);

        if (!user) {
            throw new BadRequestException('Phone or password is incorrect');
        }
        return await this.buildAuthResponse(user.id);
    }
    async changePassword(data: ChangePasswordData) {
        try {
            const { email, phone, currentPassword, newPassword } = data;

            if (!email && !phone) {
                throw new BadRequestException('Email or phone is required');
            }

            if (currentPassword === newPassword) {
                throw new BadRequestException(
                    'New password must be different from current password',
                );
            }

            const user = await this.prismaService.client.user.findFirst({
                where: {
                    ...(email && phone
                        ? { email, phone }
                        : email
                          ? { email }
                          : { phone }),
                    active: true,
                },
            });

            if (!user) {
                throw new BadRequestException('User not found');
            }

            const isCorrectPassword = await Bun.password.verify(
                currentPassword,
                user.password,
            );

            if (!isCorrectPassword) {
                throw new BadRequestException(
                    'Current password is incorrect',
                );
            }

            const hashedPassword = await Bun.password.hash(newPassword, {
                cost: 10,
                algorithm: 'bcrypt',
            });

            await this.prismaService.transaction(async (tx) => {
                await tx.user.update({
                    where: {
                        id: user.id,
                    },
                    data: {
                        password: hashedPassword,
                    },
                });

                await tx.authToken.updateMany({
                    where: {
                        userId: user.id,
                        type: TokenType.REFRESH,
                        usedAt: null,
                    },
                    data: {
                        usedAt: new Date(),
                    },
                });
            });

            return {
                message: 'Password changed successfully',
            };
        } catch (err) {
            console.log('Change password error: ', err);
            throw err;
        }
    }
    private getAccessSecretKey() {
        const accessSecretKey =
            this.configService.get<string>('ACCESS_SECRET_KEY');
        if (!accessSecretKey) {
            throw new BadRequestException('ACCESS_SECRET_KEY is not configured');
        }
        return accessSecretKey;
    }
    private getRefreshSecretKey() {
        const refreshSecretKey =
            this.configService.get<string>('REFRESH_SECRET_KEY');
        if (!refreshSecretKey) {
            throw new BadRequestException(
                'REFRESH_SECRET_KEY is not configured',
            );
        }
        return refreshSecretKey;
    }
    private async getAuthPayload(userId: number): Promise<{
        user: {
            id: number;
            name: string;
            email: string;
            phone: string | null;
            birthday: Date;
            avatar: string;
            active: boolean;
        };
        roles: Role[];
        payload: AuthPayload;
    }> {
        const user = await this.prismaService.client.user.findFirst({
            where: {
                id: userId,
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                birthday: true,
                avatar: true,
                active: true,
            },
        });
        if (!user) throw new BadRequestException('User Not Found');

        const userRoles = await this.prismaService.client.userRole.findMany({
            where: {
                userId: user.id,
            },
            select: {
                role: true,
            },
        });
        const roles = userRoles.map((roleItem) => roleItem.role);

        return {
            user,
            roles,
            payload: {
                [TokenBody.EMAIL]: user.email,
                [TokenBody.SUB]: user.id,
                [TokenBody.ROLES]: roles,
            },
        };
    }
    private async signAuthTokens(payload: AuthPayload) {
        const accessToken = await this.jwtService.signAsync(
            { ...payload, [TokenBody.PURPOSE]: TokenType.ACCESS },
            {
                secret: this.getAccessSecretKey(),
                expiresIn: ACCESS_TOKEN_LIVE_TIME,
            },
        );
        const refreshToken = await this.jwtService.signAsync(
            { ...payload, [TokenBody.PURPOSE]: TokenType.REFRESH },
            {
                secret: this.getRefreshSecretKey(),
                expiresIn: REFRESH_TOKEN_LIVE_TIME,
            },
        );

        return {
            accessToken,
            refreshToken,
        };
    }
    private async saveRefreshToken(userId: number, refreshToken: string) {
        await this.prismaService.client.authToken.create({
            data: {
                userId,
                token: refreshToken,
                type: TokenType.REFRESH,
                expiresAt: new Date(
                    Date.now() + REFRESH_TOKEN_LIVE_TIME * 1000,
                ),
            },
        });
    }
    private async buildAuthResponse(userId: number) {
        const { user, roles, payload } = await this.getAuthPayload(userId);
        const { accessToken, refreshToken } = await this.signAuthTokens(payload);
        await this.saveRefreshToken(user.id, refreshToken);

        return {
            accessToken,
            refreshToken,
            user: {
                ...user,
                roles,
            },
        };
    }
    async refreshAccessToken(refreshToken: string) {
        try {
            const payload = await this.jwtService.verifyAsync<{
                sub: number;
                email: string;
                roles: Role[];
                purpose: TokenType;
            }>(refreshToken, {
                secret: this.getRefreshSecretKey(),
            });

            if (payload.purpose !== TokenType.REFRESH) {
                throw new BadRequestException('Invalid refresh token purpose');
            }

            const tokenRecord = await this.prismaService.client.authToken.findFirst({
                where: {
                    token: refreshToken,
                    type: TokenType.REFRESH,
                    usedAt: null,
                    expiresAt: {
                        gte: new Date(),
                    },
                },
            });

            if (!tokenRecord) {
                throw new BadRequestException('Refresh token is invalid');
            }

            await this.prismaService.client.authToken.update({
                where: {
                    id: tokenRecord.id,
                },
                data: {
                    usedAt: new Date(),
                },
            });

            return await this.buildAuthResponse(payload.sub);
        } catch (err) {
            if (err instanceof BadRequestException) {
                throw err;
            }
            console.log('Refresh access token error: ', err);
            throw new BadRequestException('Refresh token is invalid or expired');
        }
    }
    private getLocalProviderUserId(userId: number) {
        return `local:${userId}`;
    }
    private getFallbackSocialEmail(
        provider: AuthProvider,
        providerUserId: string,
    ) {
        const safeId = providerUserId.replace(/[^a-zA-Z0-9._-]/g, '-');
        return `${provider.toLowerCase()}-${safeId}@social.local`;
    }
    private async ensureDefaultRole(
        tx: TransactionClientExtended,
        userId: number,
    ) {
        const userRole = await tx.userRole.findFirst({
            where: {
                userId,
                role: Role.CUSTOMER,
            },
        });
        if (!userRole) {
            await tx.userRole.create({
                data: {
                    userId,
                    role: Role.CUSTOMER,
                },
            });
        }
    }
    private async resolveSocialLogin(profile: SocialProfile) {
        const userId = await this.prismaService.transaction(async (tx) => {
            const existingIdentity = await tx.identity.findUnique({
                where: {
                    provider_providerUserId: {
                        provider: profile.provider,
                        providerUserId: profile.providerUserId,
                    },
                },
                include: {
                    user: true,
                },
            });

            if (existingIdentity) {
                await tx.identity.update({
                    where: {
                        id: existingIdentity.id,
                    },
                    data: {
                        accessToken: profile.accessToken,
                    },
                });
                await tx.user.update({
                    where: {
                        id: existingIdentity.userId,
                    },
                    data: {
                        active: true,
                        name: existingIdentity.user.name || profile.name,
                        avatar: existingIdentity.user.avatar || profile.avatar,
                    },
                });
                await this.ensureDefaultRole(tx, existingIdentity.userId);
                return existingIdentity.userId;
            }

            const matchedUser = profile.email
                ? await tx.user.findFirst({
                      where: {
                          email: profile.email,
                      },
                  })
                : null;

            if (matchedUser) {
                await tx.identity.create({
                    data: {
                        userId: matchedUser.id,
                        provider: profile.provider,
                        providerUserId: profile.providerUserId,
                        accessToken: profile.accessToken,
                    },
                });
                await tx.user.update({
                    where: {
                        id: matchedUser.id,
                    },
                    data: {
                        active: true,
                        name: matchedUser.name || profile.name,
                        avatar: matchedUser.avatar || profile.avatar,
                    },
                });
                await this.ensureDefaultRole(tx, matchedUser.id);
                return matchedUser.id;
            }

            const generatedPassword = generatePassword();
            const hashedPassword = await Bun.password.hash(generatedPassword, {
                cost: 10,
                algorithm: 'bcrypt',
            });
            const createdUser = await tx.user.create({
                data: {
                    active: true,
                    name: profile.name,
                    email:
                        profile.email ||
                        this.getFallbackSocialEmail(
                            profile.provider,
                            profile.providerUserId,
                        ),
                    birthday: new Date('1970-01-01T00:00:00.000Z'),
                    password: hashedPassword,
                    avatar: profile.avatar,
                },
            });
            await this.ensureDefaultRole(tx, createdUser.id);
            await tx.identity.create({
                data: {
                    userId: createdUser.id,
                    provider: profile.provider,
                    providerUserId: profile.providerUserId,
                    accessToken: profile.accessToken,
                },
            });
            return createdUser.id;
        });

        return await this.buildAuthResponse(userId);
    }
    private async getFacebookProfile(
        accessToken: string,
    ): Promise<SocialProfile> {
        const { data } = await axios.get('https://graph.facebook.com/me', {
            params: {
                fields: 'id,name,email,picture',
                access_token: accessToken,
            },
        });
        if (!data?.id) {
            throw new BadRequestException('Invalid Facebook account');
        }
        return {
            provider: AuthProvider.FACEBOOK,
            providerUserId: String(data.id),
            accessToken,
            email: data.email,
            name: data.name || 'Facebook User',
            avatar: data.picture?.data?.url || '',
        };
    }
    private async getGoogleProfile(
        accessToken: string,
    ): Promise<SocialProfile> {
        const { data } = await axios.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        );
        if (!data?.sub) {
            throw new BadRequestException('Invalid Google account');
        }
        return {
            provider: AuthProvider.GOOGLE,
            providerUserId: String(data.sub),
            accessToken,
            email: data.email,
            name: data.name || data.given_name || 'Google User',
            avatar: data.picture || '',
        };
    }
    async changeEmail(phone: string, password: string) {
        try {
            const user = await this.prismaService.client.user.findFirst({
                where: { phone },
            });
            console.log(user);
            if (!user) throw new BadRequestException('User Not Found');
            if (phone.startsWith('0')) {
                phone = phone.replace('0', '84');
            }
            const result = await Bun.password.verify(password, user.password);
            if (!result) throw new BadRequestException('Wrong Password');
            const otp = generateOtp();
            const hashOtp = hashing(otp);
            //Calling twilio
            await this.prismaService.client.oTP.create({
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
            const existsOtp = await this.prismaService.client.oTP.findFirst({
                where: {
                    otp: hashedOtp,
                    type: OTPType.RESET_EMAIL_OTP,
                    usedAt: null,
                },
            });
            if (!existsOtp) throw new BadRequestException('OTP Invalid');
            if (existsOtp.expiresAt < new Date())
                throw new BadRequestException('OTP has been expired');
            await this.prismaService.client.user.update({
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
    async forgotPassword(email: string) {
        try {
            const user = await this.prismaService.client.user.findFirst({
                where: {
                    email,
                },
            });
            if (!user)
                throw new BadRequestException('Email has not been registered');
            const defaultPassword = generatePassword();
            const hashPassword = await Bun.password.hash(defaultPassword, {
                cost: 10,
                algorithm: 'bcrypt',
            });
            await this.prismaService.client.user.update({
                data: {
                    password: hashPassword,
                },
                where: {
                    id: user.id,
                },
            });
            //send email
            await this.emailService.forgotPasswordEmail(
                `[${APP_NAME}] RESET YOUR PASSWORD`,
                user.email,
                defaultPassword,
            );
            console.log('Email has been sent successfully');
            return {
                defaultPassword,
            };
        } catch (err) {
            console.log('Reset password to default error', err);
            throw err;
        }
    }

    async fbLogin(code: string) {
        try {
            const profile = await this.getFacebookProfile(code);
            return await this.resolveSocialLogin(profile);
        } catch (err) {
            console.log('Login facebook error: ', err);
            throw err;
        }
    }
    async googleLogin(accessToken: string) {
        try {
            const profile = await this.getGoogleProfile(accessToken);
            return await this.resolveSocialLogin(profile);
        } catch (err) {
            console.log('Login google error: ', err);
            throw err;
        }
    }
}
