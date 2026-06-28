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

import { HomeController } from './home.controller';
import { GetDashboardQueryDto } from './dto/home.dto';

describe('HomeController', () => {
    let controller: HomeController;
    let homeService: { getCounters: jest.Mock; getDashboard: jest.Mock };

    beforeEach(() => {
        homeService = {
            getCounters: jest.fn(),
            getDashboard: jest.fn(),
        };
        controller = new HomeController(homeService as any);
    });

    it('should forward counters request to HomeService with user id', async () => {
        homeService.getCounters.mockResolvedValue({ cartItems: 2, unreadMessages: 5 });

        const result = await controller.getCounters({ user: { id: 123 } } as any);

        expect(result).toEqual({ cartItems: 2, unreadMessages: 5 });
        expect(homeService.getCounters).toHaveBeenCalledWith(123);
    });

    it('should forward dashboard request to HomeService without user id when none is present', async () => {
        homeService.getDashboard.mockResolvedValue({ featured: [], nearby: [] });

        const result = await controller.getDashboard({ lat: 10, lng: 20 } as GetDashboardQueryDto, { user: {} } as any);

        expect(result).toEqual({ featured: [], nearby: [] });
        expect(homeService.getDashboard).toHaveBeenCalledWith(10, 20, undefined);
    });

    it('should forward dashboard request to HomeService with user id when user is authenticated', async () => {
        homeService.getDashboard.mockResolvedValue({ featured: ['item'] });

        const result = await controller.getDashboard({ lat: 10, lng: 20 } as GetDashboardQueryDto, { user: { id: 456 } } as any);

        expect(result).toEqual({ featured: ['item'] });
        expect(homeService.getDashboard).toHaveBeenCalledWith(10, 20, 456);
    });

    it('should forward dashboard request with undefined coordinates when query is empty', async () => {
        homeService.getDashboard.mockResolvedValue({ restaurants: [] });

        const result = await controller.getDashboard({} as GetDashboardQueryDto, { user: undefined } as any);

        expect(result).toEqual({ restaurants: [] });
        expect(homeService.getDashboard).toHaveBeenCalledWith(undefined, undefined, undefined);
    });
});
