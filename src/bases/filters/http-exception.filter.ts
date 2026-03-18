import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: HttpException, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const status = exception.getStatus();
        //Quyet dinh xem se gui ve cai gi
        response.status(status).json({
            path: request.url,
            notifi: 'Cloudian Notification!!!',
            ...Object(exception.getResponse()), //Message for frontend see the error log. You can comment this to enhance private
        });
    }
}
