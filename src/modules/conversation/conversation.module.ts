import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConversationController } from "./conversation.controller";
import { ConversationService } from "./conversation.service";
import { UserModule } from "../user/user.module";
@Module({
    imports: [AuthModule , UserModule], 
    controllers: [ConversationController], 
    providers: [ConversationService], 
    exports: [ConversationService]
}) 
export class ConversationModule {} 