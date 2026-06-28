jest.mock('@prisma/client', () => ({
    Prisma: {
        defineExtension: jest.fn((extension) => extension),
        getExtensionContext: jest.fn(),
        TransactionIsolationLevel: {},
    },
    PrismaClient: class {
        $extends() {
            return this;
        }
    },
}));

import { DeviceController } from './device.controller';

describe('DeviceController', () => {
    let controller: DeviceController;
    let deviceService: { register: jest.Mock };

    beforeEach(() => {
        deviceService = {
            register: jest.fn(),
        };

        controller = new DeviceController(deviceService as any);
    });

    it('should register a device for the authenticated user', async () => {
        const body = {
            deviceToken: 'fcm-token-1',
            platform: 'ios',
        };
        const registeredDevice = {
            id: 1,
            userId: 99,
            ...body,
        };
        deviceService.register.mockResolvedValueOnce(registeredDevice);

        const result = await controller.register(body, {
            user: { id: 99 },
        } as any);

        expect(deviceService.register).toHaveBeenCalledWith(99, body);
        expect(result).toEqual(registeredDevice);
    });
});
