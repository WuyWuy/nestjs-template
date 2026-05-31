// email.module.ts
import { Global, Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { join } from 'path';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';

@Global()
@Module({
    imports: [
        ConfigModule,

        MailerModule.forRootAsync({
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                transport: {
                    host: configService.get<string>('EMAIL_HOST'),
                    port: configService.get<number>('EMAIL_PORT'),
                    secure: false,
                    auth: {
                        user: configService.get<string>('EMAIL_USER') || '',
                        pass: configService.get<string>('EMAIL_PASS') || '',
                    },
                },
                defaults: {
                    from: `"No Reply" <${configService.get<string>('EMAIL_FROM')}>`,
                },
                template: {
                    dir: join(__dirname, 'templates'),
                    adapter: new HandlebarsAdapter(),
                    options: {
                        strict: true,
                    },
                },
            }),
        }),
    ],
    controllers: [EmailController],   //Using for testing only and will remove in future 
    providers: [EmailService],
    exports: [EmailService],
})
export class EmailModule {}
