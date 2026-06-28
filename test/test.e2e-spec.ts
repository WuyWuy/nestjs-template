import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestModule } from './../src/modules/test/test.module';

describe('TestController (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [TestModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('/test (GET)', () => {
        return request(app.getHttpServer())
            .get('/test')
            .expect(200)
            .expect('Server testing successfully');
    });
});
