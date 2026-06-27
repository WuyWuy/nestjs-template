import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
    T,
    Response<T>
> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<any> {
        return next.handle().pipe(
            map((data) => {
                if (data && typeof data === 'object' && !('success' in data)) {
                    if ('data' in data && 'pagination' in data) {
                        return {
                            success: true,
                            data: data.data,
                            pagination: data.pagination,
                        };
                    }
                    if ('message' in data && 'data' in data) {
                        return {
                            success: true,
                            message: data.message,
                            data: data.data,
                        };
                    }
                    if ('message' in data && !('data' in data)) {
                        return {
                            success: true,
                            message: data.message,
                        };
                    }
                }
                return {
                    success: true,
                    data,
                };
            }),
        );
    }
}
