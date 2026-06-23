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
    Role: {
        ADMIN: 'ADMIN',
    },
}));

import { AddressController } from './address.controller';

describe('AddressController', () => {
    let controller: AddressController;
    let addressService: {
        createAddress: jest.Mock;
        getAllAddresses: jest.Mock;
        findAddresses: jest.Mock;
        getAddressDetail: jest.Mock;
        updateAddress: jest.Mock;
        deleteAddress: jest.Mock;
    };

    beforeEach(() => {
        addressService = {
            createAddress: jest.fn(),
            getAllAddresses: jest.fn(),
            findAddresses: jest.fn(),
            getAddressDetail: jest.fn(),
            updateAddress: jest.fn(),
            deleteAddress: jest.fn(),
        };
        controller = new AddressController(addressService as any);
    });

    it('should forward create requests to AddressService', async () => {
        const input = {
            title: 'Home',
            latitude: 10.776889,
            longitude: 106.700806,
            fullText: '123 Nguyen Hue',
        };
        addressService.createAddress.mockResolvedValue({ id: 1, ...input });

        const result = await controller.createAddress(input);

        expect(result).toEqual({ id: 1, ...input });
        expect(addressService.createAddress).toHaveBeenCalledWith(input);
    });

    it('should forward list requests to AddressService', async () => {
        const query = { keyword: 'home', limit: 10, offset: 5 };
        addressService.getAllAddresses.mockResolvedValue([{ id: 1 }]);

        const result = await controller.getAllAddresses(query);

        expect(result).toEqual([{ id: 1 }]);
        expect(addressService.getAllAddresses).toHaveBeenCalledWith(query);
    });

    it('should forward search requests to AddressService', async () => {
        const query = { title: 'Home', latitude: 10, longitude: 20 };
        addressService.findAddresses.mockResolvedValue([{ id: 1 }]);

        const result = await controller.findAddresses(query);

        expect(result).toEqual([{ id: 1 }]);
        expect(addressService.findAddresses).toHaveBeenCalledWith(query);
    });

    it('should forward detail requests to AddressService', async () => {
        addressService.getAddressDetail.mockResolvedValue({ id: 12 });

        const result = await controller.getAddressDetail(12);

        expect(result).toEqual({ id: 12 });
        expect(addressService.getAddressDetail).toHaveBeenCalledWith(12);
    });

    it('should pass actor id when updating an address', async () => {
        const data = { title: 'Office' };
        addressService.updateAddress.mockResolvedValue({ id: 12, ...data });

        const result = await controller.updateAddress(
            { user: { id: 99 } } as any,
            12,
            data,
        );

        expect(result).toEqual({ id: 12, ...data });
        expect(addressService.updateAddress).toHaveBeenCalledWith(99, 12, data);
    });

    it('should pass actor id when deleting an address', async () => {
        addressService.deleteAddress.mockResolvedValue({
            message: 'Address deleted successfully',
            id: 12,
        });

        const result = await controller.deleteAddress(
            { user: { id: 99 } } as any,
            12,
        );

        expect(result).toEqual({
            message: 'Address deleted successfully',
            id: 12,
        });
        expect(addressService.deleteAddress).toHaveBeenCalledWith(99, 12);
    });
});
