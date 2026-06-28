import { PartialType } from '@nestjs/mapped-types';
import {
    PaymentMethod,
    PaymentStatus,
    RestaurantApprovalStatus,
    Role,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
    ValidateIf,
    Min,
} from 'class-validator';

export class AuditLogQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;

    @IsOptional()
    @IsString()
    action?: string;

    @IsOptional()
    @IsString()
    entityType?: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    actorId?: number;
}

export class PaymentAdminQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;

    @IsOptional()
    @IsEnum(PaymentStatus)
    paymentStatus?: PaymentStatus;

    @IsOptional()
    @IsEnum(PaymentMethod)
    method?: PaymentMethod;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    userId?: number;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    restaurantId?: number;
}

export class UpdatePaymentStatusDto {
    @IsEnum(PaymentStatus)
    paymentStatus: PaymentStatus;
}

export class AdminResetPasswordDto {
    @IsOptional()
    @IsBoolean()
    @Type(() => Boolean)
    sendEmail?: boolean = false;
}

export class ApproveRestaurantDto {
    @IsEnum(RestaurantApprovalStatus)
    @IsIn([
        RestaurantApprovalStatus.APPROVED,
        RestaurantApprovalStatus.REJECTED,
    ])
    status: RestaurantApprovalStatus;
}

export class RevenueDetailsQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}

export class AdminUsersQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;

    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @IsOptional()
    @IsString()
    keyword?: string;
}

export class BlockUserDto {
    @IsBoolean()
    @Type(() => Boolean)
    isBlocked: boolean;

    @ValidateIf((data: BlockUserDto) => data.isBlocked)
    @IsString()
    @IsNotEmpty()
    reason?: string;
}

export class UpdateRestaurantActiveStatusDto {
    @IsBoolean()
    @Type(() => Boolean)
    isActive: boolean;
}

export class CreateCategoryAdminDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsOptional()
    @IsString()
    image?: string;

    @IsString()
    @IsNotEmpty()
    description: string;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    sortOrder?: number = 0;
}

export class UpdateCategoryAdminDto extends PartialType(CreateCategoryAdminDto) {}

export class VoucherQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 20;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(0)
    offset?: number = 0;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @IsPositive()
    restaurantId?: number;

    @IsOptional()
    @IsString()
    code?: string;
}
