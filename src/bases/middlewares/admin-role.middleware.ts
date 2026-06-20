import { ConfigService } from '@nestjs/config';
import {
    ForbiddenException,
    Injectable,
    NestMiddleware,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';

type AdminJwtPayload = {
    sub?: number | string;
    email?: string;
    roles?: Role[];
    purpose?: string;
};

@Injectable()
export class AdminRoleMiddleware implements NestMiddleware {
    // Middleware chỉ cho phép truy cập khi token chứa role ADMIN
    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    async use(req: Request, _res: Response, next: NextFunction) {
        const token = this.extractBearerToken(req.headers.authorization);
        if (!token) {
            throw new UnauthorizedException('Missing access token');
        }

        const secret = this.configService.get<string>('ACCESS_SECRET_KEY');
        if (!secret) {
            throw new UnauthorizedException('ACCESS_SECRET_KEY is not configured');
        }

        try {
            const payload = await this.jwtService.verifyAsync<AdminJwtPayload>(
                token,
                { secret },
            );

            if (!Array.isArray(payload.roles) || !payload.roles.includes(Role.ADMIN)) {
                throw new ForbiddenException('Admin role required');
            }

            req.user = payload;
            next();
        } catch (error) {
            if (error instanceof ForbiddenException) {
                throw error;
            }

            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    private extractBearerToken(authorization?: string) {
        if (!authorization) {
            return null;
        }

        const [type, token] = authorization.split(' ');
        if (!type || !token || type.toLowerCase() !== 'bearer') {
            return null;
        }

        return token;
    }
}