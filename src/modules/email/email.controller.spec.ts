import { EmailController } from './email.controller';

describe('EmailController', () => {
    let controller: EmailController;
    let emailService: { send: jest.Mock };
    let dateSpy: jest.SpyInstance;

    beforeEach(() => {
        emailService = {
            send: jest.fn(),
        };
        dateSpy = jest
            .spyOn(Date.prototype, 'toISOString')
            .mockReturnValue('2026-06-23T00:00:00.000Z');

        controller = new EmailController(emailService as any);
    });

    afterEach(() => {
        dateSpy.mockRestore();
    });

    it('should send the sample email and return the response message', async () => {
        emailService.send.mockResolvedValueOnce(true);

        const result = await controller.test();

        expect(emailService.send).toHaveBeenCalledWith(
            'Testing email',
            'test',
            'nguyenkhaan2005@gmail.com',
            {
                appName: 'Cloudian Job Portal',
                name: 'John Doe',
                email: 'john@example.com',
                timestamp: '2026-06-23T00:00:00.000Z',
                actionUrl: 'https://example.com',
            },
        );
        expect(result).toEqual({
            response: true,
            message: 'Your email has been sent. Check your mail box',
        });
    });
});
