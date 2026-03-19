//Source References: https://medium.com/@anirban.pal.4341/sms-verification-using-twilio-and-nestjs-f108e8c04c3d
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
    private twilioClient: Twilio;
    constructor(private readonly configService: ConfigService) {
        const accountSid = configService.get<string>('TWILIO_ACCOUNT_SID');
        const authToken = configService.get<string>('TWILIO_AUTH_TOKEN');
        this.twilioClient = new Twilio(accountSid, authToken);
    }
    async sendOtp(phone: string) {
        const serviceSid = this.configService.get<string>(
            'TWILIO_VERIFICATION_OTP_SERVICE_SID',
        ) as string;
        let msg = '';
        await this.twilioClient.verify.v2
            .services(serviceSid)
            .verifications.create({ to: phone, channel: 'sms' })
            .then((verification) => (msg = verification.status));
        return {
            msg,
        };
    }
    async verifyOtp(phone: string, code: string) {
        const serviceSid = this.configService.get<string>(
            'TWILIO_VERIFICATION_OTP_SERVICE_SID',
        ) as string;
        let msg = '';
        await this.twilioClient.verify.v2
            .services(serviceSid)
            .verificationChecks.create({ to: phone, code: code })
            .then((verification) => (msg = verification.status));
        return {
            msg,
        };
    }
    async sendSms(phone: string, body: string) {
        const messagingServiceSid = this.configService.get<string>(
            'TWILIO_SENDING_SMS_SERVICE_SID'
        ) as string;

        const msg = await this.twilioClient.messages.create({
            body,
            messagingServiceSid,  
            to: phone,
        });

        return msg.body;
    }
}
