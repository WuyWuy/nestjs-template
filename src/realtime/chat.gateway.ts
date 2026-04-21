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
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer} from '@nestjs/websockets' 
import { ChatMessage } from './dto/chat.dto'
import { UseFilters, UsePipes, ValidationPipe } from '@nestjs/common'
import { WebSocketExceptionFilter } from './ws-exception.filter'
import {Server , Socket} from 'socket.io'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { ChatResponseBody, ChatStatus } from './chat.constants'
import { ChatService } from './chat.service'

export interface AuthenticatedSocket extends Socket {
    user?: any 
}

@WebSocketGateway() 
@UseFilters(new WebSocketExceptionFilter())
@UsePipes(new ValidationPipe())
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect
{
    constructor(
        private readonly configService : ConfigService, 
        private readonly jwtService : JwtService, 
        private readonly chatService : ChatService
    ) {} 
    @WebSocketServer() 
    server : Server 
    handleConnection(client: AuthenticatedSocket, ...args: any[]) {
        //Authentication 
        console.log(args)
        console.log("Client connected" , client.id) 
        const authHeader = client.handshake.headers['authorization'];
        if (authHeader) {
            try 
            {
                const token = authHeader.split(' ')[1] 
                const payload = this.jwtService.verify(token , {
                    secret: this.configService.get('ACCESS_SECRET_KEY') 
                })
                client.user = payload 
            } 
            catch (err) 
            {
                console.log(err) 
                client.emit('exception' , {
                    [ChatResponseBody.CONTENT] : "Unauthorized User",  
                    [ChatResponseBody.STATUS] : "error"
                })
                client.disconnect() 
            }
        } 
        else {
            client.emit("exception" , {
                [ChatResponseBody.STATUS]: ChatStatus.ERROR, 
                [ChatResponseBody.CONTENT]: "Client is undefined"
            })
            client.disconnect() 
        }
    }
    @UsePipes(new ValidationPipe( {transform : true }))
    @SubscribeMessage('join-room') 
    async handJoinRoom(
        @MessageBody() data : { conversationId : number }, 
        @ConnectedSocket() client : AuthenticatedSocket
    ) 
    {
        const conversation = await this.chatService.validateConversation(client.user.sub , data.conversationId) 
        if (conversation)
            client.join(`room-${data.conversationId}`)
    }
    @SubscribeMessage('text-chat') 
    @UsePipes(new ValidationPipe()) 
    async handleMessage(
        @ConnectedSocket() client : AuthenticatedSocket, 
        @MessageBody() message : ChatMessage, 

    ) {
        const conversationId = message.conversationId 
        const { sub } = client.user.sub 
        const storeRes = await this.chatService.storeDbAndEmitMessage(Number(sub) , message) 
        if (storeRes)
        this.server.to(`room-${conversationId}`).emit('text-chat' , {
            data : storeRes, 
            [ChatResponseBody.STATUS] : "success"
        })
    }
    handleDisconnect(client: Socket) {
        console.log("Client disconnected: " , client.id)
    }
}