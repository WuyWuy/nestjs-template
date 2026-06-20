import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('01. Khởi động')
@Controller('/test')
export class TestController {
    @ApiOperation({ summary: 'Smoke test nhanh cho server' })
    @Get()
    testing() {
        return 'Server testing successfully';
    }
}
