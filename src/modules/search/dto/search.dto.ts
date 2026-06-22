import { Type } from 'class-transformer';
import {
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchQueryDto {
    @ApiProperty({
        description: 'Từ khóa tìm kiếm (tên món ăn, tên nhà hàng, label, tags)',
        example: 'bún chả',
    })
    @IsNotEmpty()
    @IsString()
    q: string;

    @ApiPropertyOptional({
        description: 'Vĩ độ hiện tại của người dùng',
        example: 10.762622,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    lat?: number;

    @ApiPropertyOptional({
        description: 'Kinh độ hiện tại của người dùng',
        example: 106.660172,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    lng?: number;

    @ApiPropertyOptional({
        description: 'Số lượng bản ghi tối đa trả về cho mỗi loại',
        default: 20,
        example: 20,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @ApiPropertyOptional({
        description: 'Số bản ghi bỏ qua cho phân trang',
        default: 0,
        example: 0,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;

    @ApiPropertyOptional({
        description: 'Tiêu chí sắp xếp: distance, rating, price_low_to_high',
        example: 'distance',
    })
    @IsOptional()
    @IsString()
    @IsIn(['distance', 'rating', 'price_low_to_high'])
    sort?: string;

    @ApiPropertyOptional({
        description: 'Lọc theo danh mục món ăn cụ thể',
        example: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    categoryId?: number;
}

export class SearchSuggestionsQueryDto {
    @ApiPropertyOptional({
        description: 'Vĩ độ hiện tại của người dùng',
        example: 10.762622,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    lat?: number;

    @ApiPropertyOptional({
        description: 'Kinh độ hiện tại của người dùng',
        example: 106.660172,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    lng?: number;

    @ApiPropertyOptional({
        description: 'Số lượng gợi ý tối đa cho mỗi mục',
        default: 10,
        example: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;
}

export class SaveSearchHistoryDto {
    @ApiProperty({
        description: 'Từ khóa tìm kiếm cần lưu vào lịch sử',
        example: 'bún chả',
    })
    @IsNotEmpty()
    @IsString()
    keyword: string;
}

export class TrendingQueryDto {
    @ApiPropertyOptional({
        description: 'Số lượng từ khóa thịnh hành tối đa muốn lấy',
        default: 10,
        example: 10,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;
}
