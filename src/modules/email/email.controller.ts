import { Controller, Get } from '@nestjs/common';
import { EmailService } from './email.service';

@Controller('/email')
export class EmailController {
    constructor(
        private readonly emailService : EmailService
    ) { }
    @Get()
    async test() {
        const context = {
            appName: 'Cloudian Job Portal',
            name: 'John Doe',
            email: 'john@example.com',
            timestamp: new Date().toISOString(),
            actionUrl: 'https://example.com',
        };
        const response = await this.emailService.send(
            'Testing email', 'test', 'nguyenkhaan2005@gmail.com', context
        )
        return {
            response, message: "Your email has been sent. Check your mail box" 
        }
    }
}
