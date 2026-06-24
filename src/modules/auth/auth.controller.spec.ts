jest.mock('./auth.service', () => ({
    AuthService: class {},
}));

import { AuthController } from './auth.controller';

describe('AuthController', () => {
    it('returns basic information for the authenticated user', async () => {
        const me = {
            id: 10,
            email: 'user@example.com',
            roles: ['CUSTOMER'],
        };
        const authService = {
            getMe: jest.fn().mockResolvedValue(me),
        };
        const controller = new AuthController(authService as any);

        await expect(
            controller.getMe({ user: { id: 10 } } as any),
        ).resolves.toEqual(me);
        expect(authService.getMe).toHaveBeenCalledWith(10);
    });
});
