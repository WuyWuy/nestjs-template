import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('01. Init')
@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @ApiOperation({ summary: 'API gốc của hệ thống' })
    @Get()
    getHello(): string {
        return this.appService.getHello();
    }
}
