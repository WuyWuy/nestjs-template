import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class EmailService {
    constructor(private readonly mailerService: MailerService) {}

    getTemplate() : any {
        return {
            forgotPassword: {
                path: 'forgotPassword', // no .hbs needed here
                key: 'defaultPassword',
            },
        };
    }

    async forgotPasswordEmail(
        subject: string,
        to : string, 
        defaultPassword : string 
    ) {
        try {
            await this.mailerService.sendMail({
                to, 
                subject,
                template: 'forgotPassword',
                context: {
                    defaultPassword: defaultPassword,
                },
            });

            return true;
        } catch (err) {
            console.error('Send email error:', err);
            throw err;
        }
    }
}
