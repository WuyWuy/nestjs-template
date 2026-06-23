import { EmailService } from './email.service';

describe('EmailService', () => {
    let service: EmailService;
    let mailerService: { sendMail: jest.Mock };

    beforeEach(() => {
        mailerService = {
            sendMail: jest.fn(),
        };

        service = new EmailService(mailerService as any);
    });

    it('should return configured template metadata', () => {
        expect(service.getTemplate()).toEqual({
            forgotPassword: {
                path: 'forgotPassword',
                key: 'defaultPassword',
            },
        });
    });

    it('should send forgot password email with default password context', async () => {
        mailerService.sendMail.mockResolvedValueOnce(undefined);

        const result = await service.forgotPasswordEmail(
            'Reset your password',
            'user@example.com',
            'TempPass123',
        );

        expect(mailerService.sendMail).toHaveBeenCalledWith({
            to: 'user@example.com',
            subject: 'Reset your password',
            template: 'forgotPassword',
            context: {
                defaultPassword: 'TempPass123',
            },
        });
        expect(result).toBe(true);
    });

    it('should log and rethrow forgot password email errors', async () => {
        const error = new Error('smtp unavailable');
        mailerService.sendMail.mockRejectedValueOnce(error);
        jest.spyOn(console, 'error').mockImplementationOnce(() => undefined);

        await expect(
            service.forgotPasswordEmail(
                'Reset your password',
                'user@example.com',
                'TempPass123',
            ),
        ).rejects.toThrow(error);
        expect(console.error).toHaveBeenCalledWith('Send email error:', error);
    });

    it('should send reset password OTP email with otp context', async () => {
        mailerService.sendMail.mockResolvedValueOnce(undefined);

        const result = await service.resetPasswordOtpEmail(
            'Your OTP',
            'user@example.com',
            '123456',
        );

        expect(mailerService.sendMail).toHaveBeenCalledWith({
            to: 'user@example.com',
            subject: 'Your OTP',
            template: 'resetPasswordOtp',
            context: {
                otp: '123456',
            },
        });
        expect(result).toBe(true);
    });

    it('should log and rethrow reset password OTP email errors', async () => {
        const error = new Error('smtp unavailable');
        mailerService.sendMail.mockRejectedValueOnce(error);
        jest.spyOn(console, 'error').mockImplementationOnce(() => undefined);

        await expect(
            service.resetPasswordOtpEmail(
                'Your OTP',
                'user@example.com',
                '123456',
            ),
        ).rejects.toThrow(error);
        expect(console.error).toHaveBeenCalledWith('Send email error:', error);
    });

    it('should send an arbitrary template email with copied context', async () => {
        mailerService.sendMail.mockResolvedValueOnce(undefined);

        const result = await service.send(
            'Testing email',
            'test',
            'user@example.com',
            {
                name: 'John Doe',
                actionUrl: 'https://example.com',
            },
        );

        expect(mailerService.sendMail).toHaveBeenCalledWith({
            to: 'user@example.com',
            subject: 'Testing email',
            template: 'test',
            context: {
                name: 'John Doe',
                actionUrl: 'https://example.com',
            },
        });
        expect(result).toBe(true);
    });

    it('should log and rethrow arbitrary template email errors', async () => {
        const error = new Error('smtp unavailable');
        mailerService.sendMail.mockRejectedValueOnce(error);
        jest.spyOn(console, 'log').mockImplementationOnce(() => undefined);

        await expect(
            service.send('Testing email', 'test', 'user@example.com', {
                name: 'John Doe',
            }),
        ).rejects.toThrow(error);
        expect(console.log).toHaveBeenCalledWith('Send email error: ', error);
    });
});
