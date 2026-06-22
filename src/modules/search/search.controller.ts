import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';
import {
    SearchQueryDto,
    SearchSuggestionsQueryDto,
    SaveSearchHistoryDto,
    TrendingQueryDto,
} from './dto/search.dto';

@ApiTags('16. Search')
@Controller('search')
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @ApiOperation({ summary: 'Tìm kiếm hợp nhất (Foods & Restaurants)' })
    @Get()
    async search(@Query() query: SearchQueryDto) {
        return await this.searchService.search(query);
    }

    @ApiOperation({ summary: 'Gợi ý mặc định khi thanh search trống' })
    @Get('suggestions')
    async getSuggestions(@Query() query: SearchSuggestionsQueryDto) {
        return await this.searchService.getSuggestions(query);
    }

    @ApiOperation({ summary: 'Lấy danh sách lịch sử tìm kiếm' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('history')
    async getHistory(@Req() req: Request) {
        const userId = Number((req.user as { id?: number })?.id);
        const data = await this.searchService.getHistory(userId);
        return {
            success: true,
            data,
        };
    }

    @ApiOperation({ summary: 'Lưu từ khóa vào lịch sử tìm kiếm' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post('history')
    async saveHistory(@Req() req: Request, @Body() data: SaveSearchHistoryDto) {
        const userId = Number((req.user as { id?: number })?.id);
        const result = await this.searchService.saveHistory(userId, data);
        return {
            success: true,
            message: 'Save search history successfully',
            data: result,
        };
    }

    @ApiOperation({ summary: 'Xóa toàn bộ lịch sử tìm kiếm' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Delete('history')
    async clearHistory(@Req() req: Request) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.searchService.clearHistory(userId);
    }

    @ApiOperation({ summary: 'Xóa một từ khóa cụ thể trong lịch sử' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Delete('history/:id')
    async deleteHistoryItem(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.searchService.deleteHistoryItem(userId, id);
    }

    @ApiOperation({ summary: 'Lấy từ khóa thịnh hành 7 ngày qua' })
    @Get('trending')
    async getTrending(@Query() query: TrendingQueryDto) {
        const data = await this.searchService.getTrending(query);
        return {
            success: true,
            data,
        };
    }
}
