import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChatMessage {
    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    conversationId: number;
    @IsString()
    @IsOptional()
    content?: string;
    @IsString()
    @IsOptional()
    image?: string;
}
export class JoiNRoomDto {
    @IsInt()
    @IsNotEmpty()
    @Type(() => Number)
    conversationId: number;
}
