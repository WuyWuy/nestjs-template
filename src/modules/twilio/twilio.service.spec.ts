const mockVerificationsCreate = jest.fn();
const mockVerificationChecksCreate = jest.fn();
const mockServices = jest.fn();
const mockMessagesCreate = jest.fn();
const mockTwilioConstructor = jest.fn();

jest.mock('twilio', () => ({
    Twilio: jest.fn().mockImplementation((accountSid, authToken) => {
        mockTwilioConstructor(accountSid, authToken);
        return {
            verify: {
                v2: {
                    services: mockServices,
                },
            },
            messages: {
                create: mockMessagesCreate,
            },
        };
    }),
}));

import { ConfigService } from '@nestjs/config';
import { TwilioModule } from './twilio.module';
import { TwilioService } from './twilio.service';

describe('TwilioService', () => {
    let service: TwilioService;
    let configService: { get: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();

        mockServices.mockReturnValue({
            verifications: {
                create: mockVerificationsCreate,
            },
            verificationChecks: {
                create: mockVerificationChecksCreate,
            },
        });

        configService = {
            get: jest.fn((key: string) => {
                const values: Record<string, string> = {
                    TWILIO_ACCOUNT_SID: 'account-sid',
                    TWILIO_AUTH_TOKEN: 'auth-token',
                    TWILIO_VERIFICATION_OTP_SERVICE_SID:
                        'verification-service-sid',
                    TWILIO_SENDING_SMS_SERVICE_SID: 'messaging-service-sid',
                };
                return values[key];
            }),
        };

        service = new TwilioService(configService as unknown as ConfigService);
    });

    it('should create a Twilio client from configured credentials', () => {
        expect(mockTwilioConstructor).toHaveBeenCalledWith(
            'account-sid',
            'auth-token',
        );
        expect(configService.get).toHaveBeenCalledWith('TWILIO_ACCOUNT_SID');
        expect(configService.get).toHaveBeenCalledWith('TWILIO_AUTH_TOKEN');
    });

    it('should send an OTP through the configured verification service', async () => {
        mockVerificationsCreate.mockResolvedValueOnce({ status: 'pending' });

        const result = await service.sendOtp('+84901234567');

        expect(configService.get).toHaveBeenCalledWith(
            'TWILIO_VERIFICATION_OTP_SERVICE_SID',
        );
        expect(mockServices).toHaveBeenCalledWith('verification-service-sid');
        expect(mockVerificationsCreate).toHaveBeenCalledWith({
            to: '+84901234567',
            channel: 'sms',
        });
        expect(result).toEqual({ msg: 'pending' });
    });

    it('should verify an OTP through the configured verification service', async () => {
        mockVerificationChecksCreate.mockResolvedValueOnce({
            status: 'approved',
        });

        const result = await service.verifyOtp('+84901234567', '123456');

        expect(configService.get).toHaveBeenCalledWith(
            'TWILIO_VERIFICATION_OTP_SERVICE_SID',
        );
        expect(mockServices).toHaveBeenCalledWith('verification-service-sid');
        expect(mockVerificationChecksCreate).toHaveBeenCalledWith({
            to: '+84901234567',
            code: '123456',
        });
        expect(result).toEqual({ msg: 'approved' });
    });

    it('should send an SMS through the configured messaging service', async () => {
        mockMessagesCreate.mockResolvedValueOnce({ body: 'Your OTP is 123456' });

        const result = await service.sendSms(
            '+84901234567',
            'Your OTP is 123456',
        );

        expect(configService.get).toHaveBeenCalledWith(
            'TWILIO_SENDING_SMS_SERVICE_SID',
        );
        expect(mockMessagesCreate).toHaveBeenCalledWith({
            body: 'Your OTP is 123456',
            messagingServiceSid: 'messaging-service-sid',
            to: '+84901234567',
        });
        expect(result).toBe('Your OTP is 123456');
    });
});

describe('TwilioModule', () => {
    it('should export TwilioService as a global module provider', () => {
        expect(Reflect.getMetadata('__module:global__', TwilioModule)).toBe(true);
        expect(Reflect.getMetadata('providers', TwilioModule)).toEqual([
            TwilioService,
        ]);
        expect(Reflect.getMetadata('exports', TwilioModule)).toEqual([
            TwilioService,
        ]);
    });
});
