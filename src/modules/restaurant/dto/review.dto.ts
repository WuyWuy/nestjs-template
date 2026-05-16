import {
    IsInt,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

/**
 * DTO để tạo review cho nhà hàng
 * 
 * Dùng cho customer gửi review/đánh giá nhà hàng
 * - vote: điểm đánh giá (1-5 sao)
 * - comment: nhận xét, bình luận (tùy chọn)
 */
export class CreateReviewDto {
    /**
     * Điểm đánh giá (từ 1 đến 5)
     * 1 sao: Rất tệ
     * 2 sao: Tệ
     * 3 sao: Bình thường
     * 4 sao: Tốt
     * 5 sao: Rất tốt
     */
    @IsInt()
    @Min(1, { message: 'Vote must be at least 1' })
    @Max(5, { message: 'Vote must not exceed 5' })
    vote: number;

    /**
     * Bình luận chi tiết (tùy chọn)
     * Có thể để trống nếu chỉ đánh giá điểm
     */
    @IsOptional()
    @IsString()
    comment?: string;
}

/**
 * Response DTO cho review đã tạo
 * Trả về thông tin review vừa được lưu
 */
export class ReviewResponseDto {
    /** ID của review */
    id: number;
    
    /** ID nhà hàng được review */
    restaurantId: number;
    
    /** Thông tin nhà hàng */
    restaurant: {
        id: number;
        name: string;
    };
    
    /** ID khách hàng (người review) */
    userId: number;
    
    /** Thông tin khách hàng */
    user: {
        id: number;
        name: string;
    };
    
    /** Điểm đánh giá (1-5) */
    vote: number;
    
    /** Bình luận */
    comment: string;
    
    /** Thời gian tạo review */
    createdAt: Date;
}
