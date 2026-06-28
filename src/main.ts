import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';

async function bootstrap() {
    const port = process.env.PORT || 4000;
    const app = await NestFactory.create(AppModule);

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
        }),
    );

    await processSwagger(app);
    await app.listen(port);

    // --- Configuration for Display ---
    const serverName = 'BE_SERVER';
    const url = `http://localhost:${port}/api`;
    const status = 'RUNNING';

    // ANSI Colors
    const cyan = '\x1b[36m';
    const green = '\x1b[32m';
    const yellow = '\x1b[33m';
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    // Helper to ensure padding works with strings
    const pad = (str: string, len: number) => str.padEnd(len);

    console.log(`
      ${cyan}Cloudian Status:${reset}
      ${cyan}╔══════════════════════╦═══════════════════════════╗${reset}
      ${cyan}║${reset} ${bold}🚀 SERVER STARTED SUCCESSFULLY${reset}                   ${cyan}║${reset}
      ${cyan}╠══════════════════════╬═══════════════════════════╣${reset}
      ${cyan}║${reset}   ${bold}SERVICE${reset}            ${cyan}║${reset} ${pad(serverName, 25)} ${cyan}║${reset}
      ${cyan}║${reset}   ${bold}PORT${reset}               ${cyan}║${reset} ${pad(port.toString(), 25)} ${cyan}║${reset}
      ${cyan}║${reset}   ${bold}URL${reset}                ${cyan}║${reset} ${yellow}${pad(url, 25)}${reset} ${cyan}║${reset}
      ${cyan}║${reset}   ${bold}STATUS${reset}             ${cyan}║${reset} ${green}● ${pad(status, 23)}${reset} ${cyan}║${reset}
      ${cyan}╚══════════════════════╩═══════════════════════════╝${reset}
    `);

    //Api documentation : https://www.linkedin.com/pulse/write-api-documentation-like-pro-nestjs-mikayel-hovhannisyan-vqc5f
    async function processSwagger(app: INestApplication): Promise<void> {
        if (process.env.NODE_ENV === 'production') return;
        const { SwaggerModule, DocumentBuilder } =
            await import('@nestjs/swagger');
        const { apiReference } = await import('@scalar/nestjs-api-reference');
        const config = new DocumentBuilder()
            .setTitle('Backend API Documentation')
            .setDescription('Tài liệu API tiếng Việt, được sắp theo luồng test từ đầu đến cuối.')
            .addBearerAuth()
            .addTag('01. Init')
            .addTag('02. Auth')
            .addTag('03. User')
            .addTag('04. Address')
            .addTag('05. Category')
            .addTag('06. Restaurant')
            .addTag('07. Food')
            .addTag('08. Cart')
            .addTag('09. Order')
            .addTag('10. Payment')
            .addTag('11. Voucher')
            .addTag('12. Notification')
            .addTag('13. Conversation - Chat')
            .addTag('14. Health')
            .addTag('15. Admin')
            .build();
        const document = SwaggerModule.createDocument(app, config);
        app.use(
            '/api/docs',
            apiReference({
                content: document,
            }),
        );
    }
}
bootstrap();
