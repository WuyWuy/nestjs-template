import { IsNumber, IsString, IsOptional } from 'class-validator';

export class ApproveRestaurantDto {
    @IsNumber()
    restaurantId: number;
}

export class RejectRestaurantDto {
    @IsNumber()
    restaurantId: number;

    @IsString()
    rejectionReason: string;
}

export class GetRegistrationsQueryDto {
    @IsOptional()
    @IsNumber()
    limit?: number;

    @IsOptional()
    @IsNumber()
    offset?: number;
}
