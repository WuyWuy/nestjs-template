import { Module } from '@nestjs/common';
import { TestController } from './test.controller';

@Module({
    controllers: [TestController],
    imports: [],
    exports: [],
    providers: [],
})
export class TestModule {}
