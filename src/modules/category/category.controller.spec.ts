jest.mock('@prisma/client', () => ({
    Role: {
        ADMIN: 'ADMIN',
        BUSINESS: 'BUSINESS',
    },
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

import { CategoryController } from './category.controller';

describe('CategoryController', () => {
    let controller: CategoryController;
    let categoryService: {
        getCategories: jest.Mock;
        getCategoryDetail: jest.Mock;
        createCategory: jest.Mock;
        updateCategory: jest.Mock;
        deleteCategory: jest.Mock;
    };

    beforeEach(() => {
        categoryService = {
            getCategories: jest.fn(),
            getCategoryDetail: jest.fn(),
            createCategory: jest.fn(),
            updateCategory: jest.fn(),
            deleteCategory: jest.fn(),
        };

        controller = new CategoryController(categoryService as any);
    });

    it('should forward list requests to CategoryService', async () => {
        const query = { keyword: 'bur', limit: 5, offset: 0 };
        categoryService.getCategories.mockResolvedValue([{ id: 1 }]);

        const result = await controller.getCategories(query);

        expect(result).toEqual([{ id: 1 }]);
        expect(categoryService.getCategories).toHaveBeenCalledWith(query);
    });

    it('should forward detail requests to CategoryService', async () => {
        categoryService.getCategoryDetail.mockResolvedValue({ id: 1 });

        const result = await controller.getCategoryDetail(1);

        expect(result).toEqual({ id: 1 });
        expect(categoryService.getCategoryDetail).toHaveBeenCalledWith(1);
    });

    it('should pass actor id, body and file when creating a category', async () => {
        const data = { name: 'Burger', description: 'Fast food' };
        const file = { originalname: 'burger.jpg' } as any;
        categoryService.createCategory.mockResolvedValue({ id: 1, ...data });

        const result = await controller.createCategory(
            { user: { id: 99 } } as any,
            data,
            file,
        );

        expect(result).toEqual({ id: 1, ...data });
        expect(categoryService.createCategory).toHaveBeenCalledWith(
            99,
            data,
            file,
        );
    });

    it('should pass actor id, category id, body and file when updating a category', async () => {
        const data = { name: 'Fast Food' };
        const file = { originalname: 'fast-food.jpg' } as any;
        categoryService.updateCategory.mockResolvedValue({ id: 1, ...data });

        const result = await controller.updateCategory(
            { user: { id: 99 } } as any,
            1,
            data,
            file,
        );

        expect(result).toEqual({ id: 1, ...data });
        expect(categoryService.updateCategory).toHaveBeenCalledWith(
            99,
            1,
            data,
            file,
        );
    });

    it('should pass actor id and category id when deleting a category', async () => {
        categoryService.deleteCategory.mockResolvedValue({
            message: 'Category deleted successfully',
        });

        const result = await controller.deleteCategory(
            { user: { id: 99 } } as any,
            1,
        );

        expect(result).toEqual({
            message: 'Category deleted successfully',
        });
        expect(categoryService.deleteCategory).toHaveBeenCalledWith(99, 1);
    });
});
