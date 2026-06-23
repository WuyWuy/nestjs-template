import { TestController } from './test.controller';
import { TestModule } from './test.module';

describe('TestController', () => {
    let controller: TestController;

    beforeEach(() => {
        controller = new TestController();
    });

    it('should return a smoke test string', () => {
        expect(controller.testing()).toBe('Server testing successfully');
    });

    it('should return the same smoke test response on repeated calls', () => {
        expect(controller.testing()).toBe('Server testing successfully');
        expect(controller.testing()).toBe('Server testing successfully');
    });
});

describe('TestModule', () => {
    it('should register TestController without providers or imports', () => {
        expect(Reflect.getMetadata('controllers', TestModule)).toEqual([
            TestController,
        ]);
        expect(Reflect.getMetadata('providers', TestModule)).toEqual([]);
        expect(Reflect.getMetadata('imports', TestModule)).toEqual([]);
        expect(Reflect.getMetadata('exports', TestModule)).toEqual([]);
    });
});
