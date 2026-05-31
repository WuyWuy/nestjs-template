/**
 * Cu phap socket.io trong nestjs (Chuyen doi tuong duong )
 * socket.emit = client.emit
 * socket.on = @SubscribedMessage
 * io.emit = this.server.emit
 * io.to.emit = this.server.to(room).emit()
 * socket.join(room) = client.join(room)
 * socket.leave(room) = client.leave(room)
 *
 *
 */
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { ChatMessage, JoiNRoomDto } from './dto/chat.dto';
import { UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { WebSocketExceptionFilter } from './ws-exception.filter';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ChatEvent, ChatResponseBody, ChatStatus } from './chat.constants';
import { ChatService } from './chat.service';

export interface AuthenticatedSocket extends Socket {
    user?: {
        id: number;
        email?: string;
        roles?: string[];
        purpose?: string;
    };
}

@WebSocketGateway()
@UseFilters(new WebSocketExceptionFilter())
@UsePipes(new ValidationPipe())
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    constructor(
        private readonly configService: ConfigService,
        private readonly jwtService: JwtService,
        private readonly chatService: ChatService,
    ) {}
    @WebSocketServer()
    server: Server;

    handleConnection(client: AuthenticatedSocket) {
        const authHeader = client.handshake.headers['authorization'];
        if (authHeader) {
            try {
                const token = authHeader.split(' ')[1];
                const payload = this.jwtService.verify(token, {
                    secret: this.configService.get('ACCESS_SECRET_KEY'),
                });
                client.user = {
                    id: Number(payload.sub ?? payload.id),
                    email: payload.email,
                    roles: payload.roles,
                    purpose: payload.purpose,
                };
            } catch (err) {
                console.log("Chatting err: " , err) 
                client.emit('exception', {
                    [ChatResponseBody.CONTENT]: 'Unauthorized User',
                    [ChatResponseBody.STATUS]: ChatStatus.ERROR,
                });
                client.disconnect();
            }
        } else {
            client.emit('exception', {
                [ChatResponseBody.STATUS]: ChatStatus.ERROR,
                [ChatResponseBody.CONTENT]: 'Client is undefined',
            });
            client.disconnect();
        }
    }
    @UsePipes(new ValidationPipe({ transform: true }))
    @SubscribeMessage(ChatEvent.JOIN_ROOM)
    async handJoinRoom(
        @MessageBody() data: JoiNRoomDto,
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        const conversation = await this.chatService.validateConversation(
            client.user?.id ?? 0,
            data.conversationId,
        );

        if (conversation) {
            client.join(`room-${data.conversationId}`);
            client.emit(ChatEvent.JOIN_ROOM, {
                [ChatResponseBody.STATUS]: ChatStatus.SUCCESS,
                data: {
                    conversationId: data.conversationId,
                },
            });
        }
    }

    @SubscribeMessage(ChatEvent.LEAVE_ROOM)
    async handleLeaveRoom(
        @MessageBody() data: JoiNRoomDto,
        @ConnectedSocket() client: AuthenticatedSocket,
    ) {
        await this.chatService.validateConversation(
            client.user?.id ?? 0,
            data.conversationId,
        );
        client.leave(`room-${data.conversationId}`);
        client.emit(ChatEvent.LEAVE_ROOM, {
            [ChatResponseBody.STATUS]: ChatStatus.SUCCESS,
            data: {
                conversationId: data.conversationId,
            },
        });
    }

    @SubscribeMessage(ChatEvent.TEXT_CHAT)
    @UsePipes(new ValidationPipe())
    async handleMessage(
        @ConnectedSocket() client: AuthenticatedSocket,
        @MessageBody() message: ChatMessage,
    ) {
        const conversationId = message.conversationId;
        const storeRes = await this.chatService.storeDbAndEmitMessage(
            Number(client.user?.id ?? 0),
            message,
        );
        if (storeRes)
            this.server.to(`room-${conversationId}`).emit(ChatEvent.TEXT_CHAT, {
                data: storeRes,
                [ChatResponseBody.STATUS]: ChatStatus.SUCCESS,
            });
    }

    handleDisconnect(client: Socket) {
        client.rooms.clear();
    }
}
