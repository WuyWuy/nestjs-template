import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ChatResponseBody } from './chat.constants';

@Catch(WsException)
export class WebSocketExceptionFilter implements ExceptionFilter {
    catch(exception: WsException, host: ArgumentsHost) {
        const socket = host.switchToWs().getClient();
        const error = exception.getError();
        const message =
            typeof error === 'string'
                ? error
                : 'Chat message is invalid';

        socket.emit('exception', {
            [ChatResponseBody.STATUS]: 'error',
            [ChatResponseBody.CONTENT]: message,
        });
    }
}
