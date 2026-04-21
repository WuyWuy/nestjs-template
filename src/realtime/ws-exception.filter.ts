import { ArgumentsHost, Catch, ExceptionFilter } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import { ChatResponseBody } from "./chat.constants";

@Catch(WsException)
export class WebSocketExceptionFilter implements ExceptionFilter 
{
    catch(_exception: WsException, host: ArgumentsHost) {
        const socket = host.switchToWs().getClient() 
        socket.emit('exception' , {
            [ChatResponseBody.STATUS] : 'error', 
            [ChatResponseBody.CONTENT]: 'Chat message is invalid', 
        })
    }
}