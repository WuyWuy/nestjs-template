// import { ConfigService } from "@nestjs/config";
// import { JwtService } from "@nestjs/jwt";
import {Server , Socket} from 'socket.io'
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    WebSocketGateway, 
    WebSocketServer
} from '@nestjs/websockets'

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
@WebSocketGateway({
    cors : {
        origin: '*'
    }
})
export class socketGateway 
    implements OnGatewayConnection , OnGatewayDisconnect , OnGatewayInit
{
    @WebSocketServer()
    server : Server
    //Duoc goi sau khi gateway khoi tao 
    afterInit(server: any) {
        console.log("Server initialized") 
        console.log(server)
    } 
    //Xu li trong qua trinh client ket noi den gateway 
    handleConnection(client: Socket, ...args: any[]) {
        console.log("Client is connecting" , client.id)  
        console.log(args)
    } 
    //Xu li khi client disconnect 
    handleDisconnect(client: Socket) {
        console.log("Client disconnect" , client.id)
        
    }
}