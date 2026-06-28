import { TwilioService } from './twilio.service';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
    providers: [TwilioService],
    exports: [TwilioService],
})
export class TwilioModule {}
