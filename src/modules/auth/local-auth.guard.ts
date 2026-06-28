import { PUBLIC_KEY } from '@/bases/decorators/public.decorator';
import { Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core'; //Pahi impor class, khong duoc import type
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {
    constructor(private readonly reflector: Reflector) {
        super();
    }
    canActivate(context: ExecutionContext) {
        const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) return true;
        return super.canActivate(context);
    }
}
