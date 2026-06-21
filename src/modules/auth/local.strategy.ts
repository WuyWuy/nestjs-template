import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { AuthService } from '@/modules/auth/auth.service';
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authService: AuthService) {
        super({
            usernameField: 'phone',
            passwordField: 'password',
            passReqToCallback: true,
        } as any);
    }

    // support login by phone or email (client may send `phone` or `email`)
    async validate(req: any, username: string, password: string): Promise<any> {
        const identifier = username || req?.body?.email || req?.body?.phone;
        const user = await this.authService.validateUser(identifier, password);
        if (!user) {
            throw new UnauthorizedException();
        }
        return user; // returned user will be attached to req.user
    }
}
