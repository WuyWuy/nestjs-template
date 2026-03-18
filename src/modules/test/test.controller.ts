import { Controller, Get } from '@nestjs/common';

@Controller('/test')
export class TestController {
    @Get()
    testing() {
        return 'Server testing successfully';
    }
}
