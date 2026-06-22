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
                if (
                    data &&
                    typeof data === 'object' &&
                    'data' in data &&
                    'pagination' in data
                ) {
                    return {
                        success: true,
                        data: data.data,
                        pagination: data.pagination,
                    };
                }
                return {
                    success: true,
                    data,
                };
            }),
        );
    }
}
