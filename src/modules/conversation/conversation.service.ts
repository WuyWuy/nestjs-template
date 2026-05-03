/**
 * LUỒNG HOẠT ĐỘNG 
 * Mỗi màn hình hiển thị chi tiết hóa đơn, sẽ có một nút bấm để chat <=> Mỗi hóa đơn là 1 phòng chat 
 * Scene 1: Gửi về cho người dùng danh sách tất ca hóa đơn, trong đó có kèm theo conversationId liên quan hóa đơn đó 
 * Scene 2: Khi bấm vào 1 thẻ Hóa đơn, sẽ hiển thị chi tiết hóa đơn, đồng thời sử dụng conversationId để join socket 
 * Scene 3: Lấy thông tin lịch sử chat bằng conversationId. Join room, kết nối socket để bắt đầu nhắn tin. 
 * Join room socket dựa vào conversationId 
 */
import { PrismaService } from "@/prisma/prisma.service";
import { BadRequestException, Injectable } from "@nestjs/common"; 
import { CreateConversationDto } from "./dto/conversation.dto";
import { UserService } from "../user/user.service";

@Injectable() 
export class ConversationService 
{
    constructor(
        private readonly prismaService : PrismaService, 
        private readonly userService : UserService
    ) {} 
    async createConversation(userId : number , data : CreateConversationDto) 
    {
        const customer = await this.userService.getUserById(userId) 
        const seller = await this.userService.getUserById(userId) 
        if (!customer || !seller) 
            throw new BadRequestException("user not found") 
        try 
        {   
            const result = await this.prismaService.$transaction(async (tx) => {
                const conversation = await tx.conversation.create({
                    data: {
                        orderId: data.orderId, 
                        customerId : userId, 
                        sellerId : data.sellerId
                    }
                })
                return conversation
            }) 
            return result
        } 
        catch (err) {
            console.log("initialized conversation error" , err) 
            throw err 
        }
    }
    async getAllUserConversation(userId : number) 
    {
        const result = await this.prismaService.conversation.findMany({
            where: {
                OR: [
                    {sellerId : userId}, 
                    {customerId : userId }
                ]
            }
        }) 
        return result
    } 
    async getConversationByOrderId(userId : number , orderId : number , limit : number = 20, offset : number = 0) 
    {
        try {
            const conversation = await this.prismaService.conversation.findFirst({
                where: {
                    orderId
                }
            }) 
            if (!conversation) 
                throw new BadRequestException("conversation not found") 
            let messages = await this.prismaService.message.findMany({
                where: {
                    conversationId : conversation.id 
                }, 
                orderBy: {
                    createdAt: 'desc'
                }, 
                take: limit, 
                skip : offset
            })
            //Đánh dấu tin nhắn này là do ai gửi để FE có thể hiển thị. Người gửi thì đẩy bên trái, người khác gửi thì đẩy bên phải 
            //other : người khác, me : chính bạn 
            messages = messages.map((message) => {
                return {
                    ...message, 
                    who: (userId === message.senderId? 'me' : 'other')
                }
            }) 
            return {
                conversation, 
                messages 
               
            }
        } 
        catch (err) {
            console.log("get conversation by order id error: " , err) 
            throw err 
        }
    }
    async getConversationById() 
    {

    }
}