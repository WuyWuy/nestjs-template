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
        CUSTOMER: 'CUSTOMER',
    },
}));

import { CartController } from './cart.controller';

describe('CartController', () => {
    let controller: CartController;
    let cartService: {
        getCart: jest.Mock;
        pushCartItem: jest.Mock;
        updateCartItem: jest.Mock;
        deleteCartById: jest.Mock;
        clearCart: jest.Mock;
    };

    beforeEach(() => {
        cartService = {
            getCart: jest.fn(),
            pushCartItem: jest.fn(),
            updateCartItem: jest.fn(),
            deleteCartById: jest.fn(),
            clearCart: jest.fn(),
        };

        controller = new CartController(cartService as any);
    });

    it('should forward get cart requests with user id', async () => {
        cartService.getCart.mockResolvedValue({ id: 1, items: [] });

        const result = await controller.getCartProducts({
            user: { id: 99 },
        } as any);

        expect(result).toEqual({ id: 1, items: [] });
        expect(cartService.getCart).toHaveBeenCalledWith(99);
    });

    it('should forward push cart item requests with user id and body', async () => {
        const body = { foodId: 5, quantity: 2, foodSizeId: 11 };
        cartService.pushCartItem.mockResolvedValue({ id: 1, totalItems: 2 });

        const result = await controller.pushCartItem(
            { user: { id: 99 } } as any,
            body,
        );

        expect(result).toEqual({ id: 1, totalItems: 2 });
        expect(cartService.pushCartItem).toHaveBeenCalledWith(99, body);
    });

    it('should forward update cart item requests with user id, item id and body', async () => {
        const body = { quantity: 4 };
        cartService.updateCartItem.mockResolvedValue({ id: 1, totalItems: 4 });

        const result = await controller.updateCartItem(
            { user: { id: 99 } } as any,
            20,
            body,
        );

        expect(result).toEqual({ id: 1, totalItems: 4 });
        expect(cartService.updateCartItem).toHaveBeenCalledWith(99, 20, body);
    });

    it('should forward delete cart item requests with user id and item id', async () => {
        cartService.deleteCartById.mockResolvedValue({ id: 1, totalItems: 0 });

        const result = await controller.deleteCartItem(
            { user: { id: 99 } } as any,
            20,
        );

        expect(result).toEqual({ id: 1, totalItems: 0 });
        expect(cartService.deleteCartById).toHaveBeenCalledWith(99, 20);
    });

    it('should forward clear cart requests with user id', async () => {
        cartService.clearCart.mockResolvedValue({
            message: 'Cart cleared successfully',
        });

        const result = await controller.clearCart({ user: { id: 99 } } as any);

        expect(result).toEqual({
            message: 'Cart cleared successfully',
        });
        expect(cartService.clearCart).toHaveBeenCalledWith(99);
    });
});
