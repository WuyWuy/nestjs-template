// test/restaurant.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Restaurant (e2e)', () => {
    let app: INestApplication<App>;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    describe('GET /restaurant/stats/:id', () => {
        it('should return restaurant stats for valid restaurant id', () => {
            return request(app.getHttpServer())
                .get('/restaurant/stats/1')
                .expect(200)
                .expect((res) => {
                    expect(res.body).toHaveProperty('totalOrders');
                    expect(res.body).toHaveProperty('totalRevenue');
                    expect(res.body).toHaveProperty('averageRating');
                    expect(res.body).toHaveProperty('totalRatings');
                    expect(res.body).toHaveProperty('totalFoods');
                    
                    // Verify types
                    expect(typeof res.body.totalOrders).toBe('number');
                    expect(typeof res.body.totalRevenue).toBe('number');
                    expect(typeof res.body.averageRating).toBe('number');
                    expect(typeof res.body.totalRatings).toBe('number');
                    expect(typeof res.body.totalFoods).toBe('number');
                });
        });

        it('should return 404 for non-existent restaurant', () => {
            return request(app.getHttpServer())
                .get('/restaurant/stats/99999')
                .expect(404)
                .expect((res) => {
                    expect(res.body).toHaveProperty('message');
                    expect(res.body.message).toBe('Restaurant not found');
                });
        });

        it('should handle invalid restaurant id parameter', () => {
            return request(app.getHttpServer())
                .get('/restaurant/stats/invalid')
                .expect(400);
        });
    });
});