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
    Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
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

@ApiTags('13. Conversation - Chat')
@ApiBearerAuth()
@Controller('conversation')
export class ConversationController {
    constructor(
        private readonly conversationService: ConversationService,
        private readonly minioService: MinioService,
    ) {}

    @ApiOperation({ summary: 'Lấy danh sách hội thoại của tôi' })
    @UseGuards(JwtAuthGuard)
    @Get('/me')
    async getMyConversations(@Req() req: Request) {
        const userId = Number((req.user as { id?: number })?.id);
        const response = await this.conversationService.getAllUserConversation(
            userId,
        );
        return response;
    }
    // Chi danh cho admin moi duoc truy cap route nay 
    
    @ApiOperation({ summary: 'Lấy danh sách hội thoại theo user (admin)' })
    @Roles(Role.ADMIN)
    @UseGuards(JwtAuthGuard , RolesGuard)
    @Get('/user/:userId')
    async getAllUsersConversations(
        @Param('userId', ParseIntPipe) userId: number
    ) {
        return await this.conversationService.getAllUserConversation(
            userId,
        );
    }

    @ApiOperation({ summary: 'Tạo hội thoại mới cho khách hàng' })
    @ApiBody({
        type: CreateConversationDto,
        examples: {
            example: {
                summary: 'Tạo hội thoại theo đơn hàng',
                value: {
                    orderId: 1,
                    sellerId: 2,
                },
            },
        },
    })
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

    @ApiOperation({ summary: 'Xem chi tiết hội thoại theo order' })
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

        @ApiOperation({ summary: 'Xem chi tiết hội thoại theo conversation id' })
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

    @ApiOperation({ summary: 'Upload ảnh chat lên MinIO' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            required: ['file'],
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'Ảnh chat cần upload',
                },
            },
        },
    })
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

    @ApiOperation({ summary: 'Đánh dấu đã đọc toàn bộ tin nhắn trong cuộc hội thoại' })
    @UseGuards(JwtAuthGuard)
    @Patch('/:conversationId/read')
    async markAsRead(
        @Param('conversationId', ParseIntPipe) conversationId: number,
        @Req() req: Request,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        await this.conversationService.markAsRead(userId, conversationId);
        return {
            success: true,
            message: 'Marked all messages as read',
        };
    }
}
