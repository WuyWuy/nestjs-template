import { TestController } from './test.controller';

describe('TestController', () => {
    let controller: TestController;

    beforeEach(() => {
        controller = new TestController();
    });

    it('should return a smoke test string', () => {
        expect(controller.testing()).toBe('Server testing successfully');
    });
});
