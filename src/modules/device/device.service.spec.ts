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

import { DeviceService } from './device.service';

describe('DeviceService', () => {
    let service: DeviceService;
    let prismaService: any;

    beforeEach(() => {
        prismaService = {
            client: {
                device: {
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                    findMany: jest.fn(),
                },
            },
        };

        service = new DeviceService(prismaService);
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should create a device when the token is not registered yet', async () => {
        const registerData = {
            deviceToken: 'fcm-token-1',
            platform: 'ios',
        };
        const createdDevice = {
            id: 1,
            userId: 99,
            ...registerData,
        };
        prismaService.client.device.findFirst.mockResolvedValueOnce(null);
        prismaService.client.device.create.mockResolvedValueOnce(createdDevice);

        const result = await service.register(99, registerData);

        expect(prismaService.client.device.findFirst).toHaveBeenCalledWith({
            where: {
                deviceToken: 'fcm-token-1',
            },
        });
        expect(prismaService.client.device.create).toHaveBeenCalledWith({
            data: {
                deviceToken: 'fcm-token-1',
                platform: 'ios',
                userId: 99,
            },
        });
        expect(prismaService.client.device.update).not.toHaveBeenCalled();
        expect(result).toEqual(createdDevice);
    });

    it('should update an existing device token with the new user and platform', async () => {
        const registerData = {
            deviceToken: 'fcm-token-1',
            platform: 'android',
        };
        const updatedDevice = {
            id: 1,
            userId: 99,
            ...registerData,
        };
        prismaService.client.device.findFirst.mockResolvedValueOnce({
            id: 1,
            deviceToken: 'fcm-token-1',
            platform: 'ios',
            userId: 10,
        });
        prismaService.client.device.update.mockResolvedValueOnce(updatedDevice);

        const result = await service.register(99, registerData);

        expect(prismaService.client.device.update).toHaveBeenCalledWith({
            where: {
                deviceToken: 'fcm-token-1',
            },
            data: {
                deviceToken: 'fcm-token-1',
                platform: 'android',
                userId: 99,
            },
        });
        expect(prismaService.client.device.create).not.toHaveBeenCalled();
        expect(result).toEqual(updatedDevice);
    });

    it('should log and rethrow errors from register', async () => {
        const error = new Error('database unavailable');
        prismaService.client.device.findFirst.mockRejectedValueOnce(error);

        await expect(
            service.register(99, {
                deviceToken: 'fcm-token-1',
                platform: 'ios',
            }),
        ).rejects.toThrow(error);
        expect(console.log).toHaveBeenCalledWith('Register Device Erro: ', error);
    });

    it('should return only device tokens for a user', async () => {
        prismaService.client.device.findMany.mockResolvedValueOnce([
            { deviceToken: 'fcm-token-1' },
            { deviceToken: 'fcm-token-2' },
        ]);

        const result = await service.findDevicesByUser(99);

        expect(prismaService.client.device.findMany).toHaveBeenCalledWith({
            where: {
                userId: 99,
            },
            select: {
                deviceToken: true,
            },
        });
        expect(result).toEqual(['fcm-token-1', 'fcm-token-2']);
    });

    it('should log and rethrow errors from findDevicesByUser', async () => {
        const error = new Error('database unavailable');
        prismaService.client.device.findMany.mockRejectedValueOnce(error);

        await expect(service.findDevicesByUser(99)).rejects.toThrow(error);
        expect(console.log).toHaveBeenCalledWith(
            'Find Devices By User Error: ',
            error,
        );
    });
});
