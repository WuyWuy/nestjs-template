import { Type } from "class-transformer";
import { IsInt, IsNotEmpty, IsString } from "class-validator";

export class ChatMessage {
    @IsInt() 
    @IsNotEmpty() 
    @Type(() => Number)
    conversationId : number  
    @IsString() 
    @IsNotEmpty() 
    content: string 
}