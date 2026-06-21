import { OTPType, TokenType } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { hashing } from '@/utilis/sha256';
import { APP_NAME } from '@/bases/commons/constants/app.constant';

jest.mock('@prisma/client', () => ({
    Prisma: {
        defineExtension: jest.fn((extension) => extension),
        getExtensionContext: jest.fn(),
        TransactionIsolationLevel: {},
    },
    PrismaClient: class {
        $extends() {
            return this;
        }
    },
    AuthProvider: {
        LOCAL: 'LOCAL',
        FACEBOOK: 'FACEBOOK',
        GOOGLE: 'GOOGLE',
    },
    OTPType: {
        RESET_PASSWORD_OTP: 'RESET_PASSWORD_OTP',
        RESET_EMAIL_OTP: 'RESET_EMAIL_OTP',
        VERIFY_OTP: 'VERIFY_OTP',
    },
    Role: {
        CUSTOMER: 'CUSTOMER',
    },
    TokenType: {
        ACCESS: 'ACCESS',
        REFRESH: 'REFRESH',
    },
}));

jest.mock('@/utilis/ranomOtp', () => ({
    generateOtp: jest.fn(() => '123456'),
}));

describe('AuthService forgot password', () => {
    let service: AuthService;
    let prismaService: any;
    let tx: any;
    let emailService: any;

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);

        tx = {
            user: {
                update: jest.fn(),
            },
            oTP: {
                updateMany: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
            },
            authToken: {
                updateMany: jest.fn(),
            },
        };
        prismaService = {
            client: {
                user: {
                    findFirst: jest.fn(),
                },
                oTP: {
                    findFirst: jest.fn(),
                },
            },
            transaction: jest.fn(async (callback) => callback(tx)),
        };
        emailService = {
            resetPasswordOtpEmail: jest.fn(),
        };

        if (!(globalThis as any).Bun) {
            (globalThis as any).Bun = {
                password: {
                    hash: jest.fn(),
                },
            };
        }
        jest.spyOn((globalThis as any).Bun.password, 'hash').mockResolvedValue(
            'hashed-new-password',
        );

        service = new AuthService(
            prismaService,
            {} as any,
            {} as any,
            {} as any,
            emailService,
        );
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('sends a reset password OTP without changing password immediately', async () => {
        prismaService.client.user.findFirst.mockResolvedValue({
            id: 10,
            email: 'user@example.com',
        });

        await expect(
            service.forgotPassword('user@example.com'),
        ).resolves.toEqual({
            message: 'Reset password OTP has been sent',
        });

        expect(tx.oTP.updateMany).toHaveBeenCalledWith({
            where: {
                userId: 10,
                type: OTPType.RESET_PASSWORD_OTP,
                usedAt: null,
            },
            data: {
                usedAt: expect.any(Date),
            },
        });
        expect(tx.oTP.create).toHaveBeenCalledWith({
            data: {
                otp: hashing('123456'),
                userId: 10,
                type: OTPType.RESET_PASSWORD_OTP,
                expiresAt: expect.any(Date),
            },
        });
        expect(tx.user.update).not.toHaveBeenCalled();
        expect(emailService.resetPasswordOtpEmail).toHaveBeenCalledWith(
            `[${APP_NAME}] RESET YOUR PASSWORD`,
            'user@example.com',
            '123456',
        );
    });

    it('resets password with a valid OTP and revokes refresh tokens', async () => {
        prismaService.client.user.findFirst.mockResolvedValue({
            id: 10,
            email: 'user@example.com',
        });
        prismaService.client.oTP.findFirst.mockResolvedValue({
            id: 99,
            userId: 10,
        });

        await expect(
            service.resetPassword({
                email: 'user@example.com',
                otp: '123456',
                newPassword: 'new-pass',
            }),
        ).resolves.toEqual({
            message: 'Password reset successfully',
        });

        expect(prismaService.client.oTP.findFirst).toHaveBeenCalledWith({
            where: {
                userId: 10,
                otp: hashing('123456'),
                type: OTPType.RESET_PASSWORD_OTP,
                usedAt: null,
                deleteAt: null,
                expiresAt: {
                    gte: expect.any(Date),
                },
            },
        });
        expect(tx.user.update).toHaveBeenCalledWith({
            where: {
                id: 10,
            },
            data: {
                password: 'hashed-new-password',
            },
        });
        expect(tx.oTP.update).toHaveBeenCalledWith({
            where: {
                id: 99,
            },
            data: {
                usedAt: expect.any(Date),
            },
        });
        expect(tx.authToken.updateMany).toHaveBeenCalledWith({
            where: {
                userId: 10,
                type: TokenType.REFRESH,
                usedAt: null,
            },
            data: {
                usedAt: expect.any(Date),
            },
        });
    });

    it('rejects invalid or expired reset password OTP', async () => {
        prismaService.client.user.findFirst.mockResolvedValue({
            id: 10,
            email: 'user@example.com',
        });
        prismaService.client.oTP.findFirst.mockResolvedValue(null);

        await expect(
            service.resetPassword({
                email: 'user@example.com',
                otp: '000000',
                newPassword: 'new-pass',
            }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(tx.user.update).not.toHaveBeenCalled();
        expect(tx.authToken.updateMany).not.toHaveBeenCalled();
    });
});
