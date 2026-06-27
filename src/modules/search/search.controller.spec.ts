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
    OrderStatus: {
        DELIVERED: 'DELIVERED',
        CONFIRMED: 'CONFIRMED',
    },
}));

import { SearchController } from './search.controller';

describe('SearchController', () => {
    let controller: SearchController;
    let searchService: {
        search: jest.Mock;
        getSuggestions: jest.Mock;
        getHistory: jest.Mock;
        saveHistory: jest.Mock;
        clearHistory: jest.Mock;
        deleteHistoryItem: jest.Mock;
        getTrending: jest.Mock;
    };

    beforeEach(() => {
        searchService = {
            search: jest.fn(),
            getSuggestions: jest.fn(),
            getHistory: jest.fn(),
            saveHistory: jest.fn(),
            clearHistory: jest.fn(),
            deleteHistoryItem: jest.fn(),
            getTrending: jest.fn(),
        };

        controller = new SearchController(searchService as any);
    });

    it('should forward search query to SearchService', async () => {
        const query = { q: 'burger', limit: 5, offset: 0 };
        searchService.search.mockResolvedValue({ foods: [], restaurants: [] });

        const result = await controller.search(query as any);

        expect(result).toEqual({ foods: [], restaurants: [] });
        expect(searchService.search).toHaveBeenCalledWith(query);
    });

    it('should forward suggestion query to SearchService', async () => {
        const query = { lat: 10.7, lng: 106.6, limit: 10 };
        searchService.getSuggestions.mockResolvedValue({
            foods: [{ id: 1 }],
            restaurants: [{ id: 101 }],
        });

        const result = await controller.getSuggestions(query);

        expect(result).toEqual({
            foods: [{ id: 1 }],
            restaurants: [{ id: 101 }],
        });
        expect(searchService.getSuggestions).toHaveBeenCalledWith(query);
    });

    it('should return search history list for the authenticated user', async () => {
        searchService.getHistory.mockResolvedValue([{ id: 1, keyword: 'pizza' }]);

        const result = await controller.getHistory({
            user: { id: 99 },
        } as any);

        expect(result).toEqual([{ id: 1, keyword: 'pizza' }]);
        expect(searchService.getHistory).toHaveBeenCalledWith(99);
    });

    it('should save search history for the authenticated user', async () => {
        const data = { keyword: 'pizza' };
        searchService.saveHistory.mockResolvedValue({ id: 1, ...data });

        const result = await controller.saveHistory(
            { user: { id: 99 } } as any,
            data,
        );

        expect(result).toEqual({
            message: 'Save search history successfully',
            data: { id: 1, keyword: 'pizza' },
        });
        expect(searchService.saveHistory).toHaveBeenCalledWith(99, data);
    });

    it('should clear and delete history using the authenticated user id', async () => {
        searchService.clearHistory.mockResolvedValue({
            message: 'Clear search history successfully',
        });
        searchService.deleteHistoryItem.mockResolvedValue({
            message: 'Delete history item successfully',
        });

        await expect(
            controller.clearHistory({ user: { id: 99 } } as any),
        ).resolves.toEqual({ message: 'Clear search history successfully' });
        await expect(
            controller.deleteHistoryItem({ user: { id: 99 } } as any, 5),
        ).resolves.toEqual({ message: 'Delete history item successfully' });

        expect(searchService.clearHistory).toHaveBeenCalledWith(99);
        expect(searchService.deleteHistoryItem).toHaveBeenCalledWith(99, 5);
    });

    it('should return trending keywords from service', async () => {
        const query = { limit: 5 };
        searchService.getTrending.mockResolvedValue([
            { keyword: 'pizza', searchCount: 10 },
        ]);

        const result = await controller.getTrending(query);

        expect(result).toEqual([{ keyword: 'pizza', searchCount: 10 }]);
        expect(searchService.getTrending).toHaveBeenCalledWith(query);
    });
});
