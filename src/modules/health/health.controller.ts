import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('01. Khởi động')
@Controller('health')
export class HealthController {
    @ApiOperation({ summary: 'Kiểm tra service còn sống' })
    @Get('/liveness')
    async liveness() {
        return 'Server is running. Build with Cloudian 💙 Cloud';
    }

    @ApiOperation({ summary: 'Kiểm tra service sẵn sàng nhận request' })
    @Get('readness')
    async readness() {
        return 'Server testing successfully';
    }
}