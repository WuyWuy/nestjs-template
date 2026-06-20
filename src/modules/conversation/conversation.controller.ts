import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Req,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import { Role } from '@prisma/client';
import {
    ConversationDetailQueryDto,
    CreateConversationDto,
} from './dto/conversation.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { MinioService } from '../minio/minio.service';
import type { Express } from 'express';

@Controller('conversation')
export class ConversationController {
    constructor(
        private readonly conversationService: ConversationService,
        private readonly minioService: MinioService,
    ) {}

    @UseGuards(JwtAuthGuard)
    @Get('/me')
    async getMyConversations(@Req() req: Request) {
        const userId = Number((req.user as { id?: number })?.id);
        const response = await this.conversationService.getAllUserConversation(
            userId,
        );
        return response;
    }

    @UseGuards(JwtAuthGuard)
    @Get('/user/:userId')
    async getAllUsersConversations(
        @Param('userId', ParseIntPipe) userId: number,
        @Req() req: Request,
    ) {
        const requesterId = Number((req.user as { id?: number })?.id);
        const safeUserId = requesterId === userId ? userId : requesterId;
        return await this.conversationService.getAllUserConversation(
            safeUserId,
        );
    }

    @Roles(Role.CUSTOMER)
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    async createConversation(
        @Req() req: Request,
        @Body() createConversation: CreateConversationDto,
    ) {
        const id = Number((req.user as { id?: number })?.id);
        const response = await this.conversationService.createConversation(
            id,
            createConversation,
        );
        return response;
    }

    @UseGuards(JwtAuthGuard)
    @Get('detail')
    async getConversationDetailById(
        @Query('orderId', ParseIntPipe) orderId: number,
        @Query() query: ConversationDetailQueryDto,
        @Req() req: Request,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        const response =
            await this.conversationService.getConversationByOrderId(
                userId,
                orderId,
                query.limit ?? 20,
                query.offset ?? 0,
            );
        return response;
    }

    @UseGuards(JwtAuthGuard)
    @Get(':conversationId')
    async getConversationById(
        @Param('conversationId', ParseIntPipe) conversationId: number,
        @Query() query: ConversationDetailQueryDto,
        @Req() req: Request,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.conversationService.getConversationById(
            userId,
            conversationId,
            query.limit ?? 20,
            query.offset ?? 0,
        );
    }

    @UseGuards(JwtAuthGuard)
    @Post('/upload-image')
    @UseInterceptors(FileInterceptor('file'))
    async uploadChatImage(
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }
        const imageUrl = await this.minioService.uploadFile(file);
        return { imageUrl };
    }
}
