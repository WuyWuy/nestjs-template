import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(configService: ConfigService) {
        const accessSecret = configService.get<string>('ACCESS_SECRET_KEY');
        if (!accessSecret) {
            throw new Error('ACCESS_SECRET is not defined');
        }
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: accessSecret,
        });
    }

    async validate(payload: any) {
        return {
            id: payload.sub, //Payload: sub ----> Change to id in the request.user
            purpose: payload.purpose,
            email: payload.email,
            roles: payload.roles, //role co them s => roles
        };
    }
}
