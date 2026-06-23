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

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CategoryService } from './category.service';

describe('CategoryService', () => {
    let service: CategoryService;
    let prismaService: any;
    let auditService: { log: jest.Mock };
    let minioService: { uploadFile: jest.Mock };

    beforeEach(() => {
        prismaService = {
            client: {
                category: {
                    findMany: jest.fn(),
                    findFirst: jest.fn(),
                    create: jest.fn(),
                    update: jest.fn(),
                    delete: jest.fn(),
                },
            },
        };
        auditService = {
            log: jest.fn(),
        };
        minioService = {
            uploadFile: jest.fn(),
        };

        service = new CategoryService(
            prismaService,
            auditService as any,
            minioService as any,
        );
    });

    it('should list categories with keyword filtering and food counts', async () => {
        prismaService.client.category.findMany.mockResolvedValueOnce([
            {
                id: 1,
                name: 'Burger',
                image: 'burger.jpg',
                description: 'Fast food',
                sortOrder: 2,
                foods: [{ id: 10 }, { id: 11 }],
            },
        ]);

        const result = await service.getCategories({
            keyword: 'bur',
            limit: 5,
            offset: 10,
        });

        expect(prismaService.client.category.findMany).toHaveBeenCalledWith({
            where: {
                name: {
                    contains: 'bur',
                    mode: 'insensitive',
                },
            },
            select: {
                id: true,
                name: true,
                image: true,
                description: true,
                sortOrder: true,
                foods: {
                    select: {
                        id: true,
                    },
                },
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            take: 5,
            skip: 10,
        });
        expect(result).toEqual([
            {
                id: 1,
                name: 'Burger',
                image: 'burger.jpg',
                description: 'Fast food',
                sortOrder: 2,
                foods: [{ id: 10 }, { id: 11 }],
                foodCount: 2,
            },
        ]);
    });

    it('should use default pagination when listing categories without query values', async () => {
        prismaService.client.category.findMany.mockResolvedValueOnce([]);

        const result = await service.getCategories({});

        expect(prismaService.client.category.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    name: undefined,
                },
                take: 50,
                skip: 0,
            }),
        );
        expect(result).toEqual([]);
    });

    it('should throw NotFoundException when category detail does not exist', async () => {
        prismaService.client.category.findFirst.mockResolvedValueOnce(null);

        await expect(service.getCategoryDetail(404)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should return category detail with food prices converted to numbers', async () => {
        prismaService.client.category.findFirst.mockResolvedValueOnce({
            id: 1,
            name: 'Burger',
            image: 'burger.jpg',
            description: 'Fast food',
            sortOrder: 2,
            foods: [
                {
                    id: 10,
                    name: 'Cheese Burger',
                    image: 'cheese.jpg',
                    price: '9.99',
                    restaurant: {
                        id: 3,
                        name: 'Burger Shop',
                    },
                },
            ],
        });

        const result = await service.getCategoryDetail(1);

        expect(prismaService.client.category.findFirst).toHaveBeenCalledWith({
            where: {
                id: 1,
            },
            select: {
                id: true,
                name: true,
                image: true,
                description: true,
                sortOrder: true,
                foods: {
                    select: {
                        id: true,
                        name: true,
                        image: true,
                        price: true,
                        restaurant: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    take: 12,
                },
            },
        });
        expect(result).toEqual({
            id: 1,
            name: 'Burger',
            image: 'burger.jpg',
            description: 'Fast food',
            sortOrder: 2,
            foods: [
                {
                    id: 10,
                    name: 'Cheese Burger',
                    image: 'cheese.jpg',
                    price: 9.99,
                    restaurant: {
                        id: 3,
                        name: 'Burger Shop',
                    },
                },
            ],
        });
    });

    it('should reject creating a duplicate category name', async () => {
        prismaService.client.category.findFirst.mockResolvedValueOnce({ id: 1 });

        await expect(
            service.createCategory(99, {
                name: 'Burger',
                description: 'Fast food',
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('should create a category with uploaded image and write an audit log', async () => {
        const file = { originalname: 'burger.jpg' } as any;
        const input = {
            name: 'Burger',
            description: 'Fast food',
            sortOrder: 2,
        };
        const createdCategory = {
            id: 1,
            ...input,
            image: 'https://cdn.example.com/burger.jpg',
        };
        prismaService.client.category.findFirst.mockResolvedValueOnce(null);
        minioService.uploadFile.mockResolvedValueOnce(
            'https://cdn.example.com/burger.jpg',
        );
        prismaService.client.category.create.mockResolvedValueOnce(createdCategory);

        const result = await service.createCategory(99, input, file);

        expect(minioService.uploadFile).toHaveBeenCalledWith(file);
        expect(prismaService.client.category.create).toHaveBeenCalledWith({
            data: {
                name: 'Burger',
                description: 'Fast food',
                image: 'https://cdn.example.com/burger.jpg',
                sortOrder: 2,
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'CREATE_CATEGORY',
            'Category',
            1,
            99,
            input,
        );
        expect(result).toEqual(createdCategory);
    });

    it('should create a category with default image and sort order when optional values are missing', async () => {
        prismaService.client.category.findFirst.mockResolvedValueOnce(null);
        prismaService.client.category.create.mockResolvedValueOnce({
            id: 1,
            name: 'Soup',
            description: 'Warm food',
            image: '',
            sortOrder: 0,
        });

        await service.createCategory(99, {
            name: 'Soup',
            description: 'Warm food',
        });

        expect(prismaService.client.category.create).toHaveBeenCalledWith({
            data: {
                name: 'Soup',
                description: 'Warm food',
                image: '',
                sortOrder: 0,
            },
        });
    });

    it('should throw NotFoundException when updating a missing category', async () => {
        prismaService.client.category.findFirst.mockResolvedValueOnce(null);

        await expect(
            service.updateCategory(99, 404, { name: 'Fast Food' }),
        ).rejects.toThrow(NotFoundException);
    });

    it('should update a category with uploaded image and write an audit log', async () => {
        const file = { originalname: 'fast-food.jpg' } as any;
        const data = {
            name: 'Fast Food',
            description: 'Quick meals',
        };
        const updatedCategory = {
            id: 1,
            ...data,
            image: 'https://cdn.example.com/fast-food.jpg',
        };
        prismaService.client.category.findFirst.mockResolvedValueOnce({
            id: 1,
            name: 'Burger',
        });
        minioService.uploadFile.mockResolvedValueOnce(
            'https://cdn.example.com/fast-food.jpg',
        );
        prismaService.client.category.update.mockResolvedValueOnce(updatedCategory);

        const result = await service.updateCategory(99, 1, data, file);

        expect(prismaService.client.category.update).toHaveBeenCalledWith({
            where: {
                id: 1,
            },
            data: {
                name: 'Fast Food',
                description: 'Quick meals',
                image: 'https://cdn.example.com/fast-food.jpg',
            },
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'UPDATE_CATEGORY',
            'Category',
            1,
            99,
            data,
        );
        expect(result).toEqual(updatedCategory);
    });

    it('should throw NotFoundException when deleting a missing category', async () => {
        prismaService.client.category.findFirst.mockResolvedValueOnce(null);

        await expect(service.deleteCategory(99, 404)).rejects.toThrow(
            NotFoundException,
        );
    });

    it('should reject deleting a category that still contains foods', async () => {
        prismaService.client.category.findFirst.mockResolvedValueOnce({
            id: 1,
            foods: [{ id: 10 }],
        });

        await expect(service.deleteCategory(99, 1)).rejects.toThrow(
            BadRequestException,
        );
        expect(prismaService.client.category.delete).not.toHaveBeenCalled();
    });

    it('should delete an empty category and write an audit log', async () => {
        prismaService.client.category.findFirst.mockResolvedValueOnce({
            id: 1,
            foods: [],
        });
        prismaService.client.category.delete.mockResolvedValueOnce({ id: 1 });

        const result = await service.deleteCategory(99, 1);

        expect(prismaService.client.category.delete).toHaveBeenCalledWith({
            id: 1,
        });
        expect(auditService.log).toHaveBeenCalledWith(
            'DELETE_CATEGORY',
            'Category',
            1,
            99,
        );
        expect(result).toEqual({
            message: 'Category deleted successfully',
        });
    });
});
