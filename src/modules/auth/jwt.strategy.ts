import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const accessSecret = configService.get<string>('ACCESS_SECRET');
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
      userID: payload.sub, //payload: sub, purpose, email, roles -> luu thogn tin nay vao request.user
      purpose: payload.purpose,
      email: payload.email,
      roles: payload.roles, //role co them s => roles
    };
  }
}
