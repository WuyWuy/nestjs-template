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
        BUSINESS: 'BUSINESS',
        CUSTOMER: 'CUSTOMER',
    },
    VoucherStatus: {
        APPLYING: 'APPLYING',
        ENDED: 'ENDED',
    },
    VoucherType: {
        MONEY: 'MONEY',
        PERCENT: 'PERCENT',
    },
}));

import { VoucherController } from './voucher.controller';

describe('VoucherController', () => {
    let controller: VoucherController;
    let voucherService: {
        getVouchers: jest.Mock;
        getVoucherByCode: jest.Mock;
        getVoucherDetail: jest.Mock;
        createVoucher: jest.Mock;
        updateVoucher: jest.Mock;
        endVoucher: jest.Mock;
    };

    beforeEach(() => {
        voucherService = {
            getVouchers: jest.fn(),
            getVoucherByCode: jest.fn(),
            getVoucherDetail: jest.fn(),
            createVoucher: jest.fn(),
            updateVoucher: jest.fn(),
            endVoucher: jest.fn(),
        };

        controller = new VoucherController(voucherService as any);
    });

    it('should forward list query to VoucherService', async () => {
        const query = { code: 'WELCOME', limit: 10, offset: 0 };
        voucherService.getVouchers.mockResolvedValue({
            success: true,
            data: [{ id: 1 }],
        });

        const result = await controller.getVouchers(
            query,
            { user: { id: 99, roles: ['ADMIN'] } } as any,
        );

        expect(result).toEqual({
            success: true,
            data: [{ id: 1 }],
        });
        expect(voucherService.getVouchers).toHaveBeenCalledWith(
            query,
            99,
            ['ADMIN'],
        );
    });

    it('should parse restaurantId when looking up voucher by code', async () => {
        voucherService.getVoucherByCode.mockResolvedValue({ id: 1 });

        const result = await controller.getVoucherByCode('WELCOME10', '101');

        expect(result).toEqual({ id: 1 });
        expect(voucherService.getVoucherByCode).toHaveBeenCalledWith(
            'WELCOME10',
            101,
        );
    });

    it('should pass undefined restaurantId when code lookup has no query value', async () => {
        voucherService.getVoucherByCode.mockResolvedValue({ id: 1 });

        await controller.getVoucherByCode('GLOBAL10');

        expect(voucherService.getVoucherByCode).toHaveBeenCalledWith(
            'GLOBAL10',
            undefined,
        );
    });

    it('should forward detail requests by id', async () => {
        voucherService.getVoucherDetail.mockResolvedValue({ id: 1 });

        const result = await controller.getVoucherDetail(1);

        expect(result).toEqual({ id: 1 });
        expect(voucherService.getVoucherDetail).toHaveBeenCalledWith(1);
    });

    it('should pass actor id, roles, body and file when creating a voucher', async () => {
        const data = {
            name: 'Welcome',
            code: 'WELCOME10',
            sale: 10,
            type: 'PERCENT',
        };
        const file = { originalname: 'voucher.jpg' } as any;
        voucherService.createVoucher.mockResolvedValue({ id: 1, ...data });

        const result = await controller.createVoucher(
            { user: { id: 99, roles: ['ADMIN'] } } as any,
            data as any,
            file,
        );

        expect(result).toEqual({ id: 1, ...data });
        expect(voucherService.createVoucher).toHaveBeenCalledWith(
            99,
            ['ADMIN'],
            data,
            file,
        );
    });

    it('should pass actor id, roles, id, body and file when updating a voucher', async () => {
        const data = { name: 'Updated' };
        const file = { originalname: 'updated.jpg' } as any;
        voucherService.updateVoucher.mockResolvedValue({ id: 1, ...data });

        const result = await controller.updateVoucher(
            { user: { id: 99, roles: ['BUSINESS'] } } as any,
            1,
            data,
            file,
        );

        expect(result).toEqual({ id: 1, ...data });
        expect(voucherService.updateVoucher).toHaveBeenCalledWith(
            99,
            ['BUSINESS'],
            1,
            data,
            file,
        );
    });

    it('should pass actor id, roles and voucher id when ending a voucher', async () => {
        voucherService.endVoucher.mockResolvedValue({
            id: 1,
            status: 'ENDED',
        });

        const result = await controller.endVoucher(
            { user: { id: 99, roles: ['ADMIN'] } } as any,
            1,
        );

        expect(result).toEqual({ id: 1, status: 'ENDED' });
        expect(voucherService.endVoucher).toHaveBeenCalledWith(
            99,
            ['ADMIN'],
            1,
        );
    });
});
