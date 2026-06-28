import { HealthController } from './health.controller';

describe('HealthController', () => {
    let controller: HealthController;

    beforeEach(() => {
        controller = new HealthController();
    });

    it('should return the liveness message', async () => {
        await expect(controller.liveness()).resolves.toContain(
            'Server is running',
        );
    });

    it('should return the readiness message', async () => {
        await expect(controller.readness()).resolves.toBe(
            'Server testing successfully',
        );
    });
});
