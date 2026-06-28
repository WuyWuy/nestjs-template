import { PartialType } from '@nestjs/mapped-types';
import { NotificationType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class NotificationQueryDto {
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
    @IsEnum(NotificationType)
    type?: NotificationType;

    @IsOptional()
    @IsString()
    read?: string;
}

export class CreateNotificationDto {
    @IsString()
    title: string;

    @IsString()
    body: string;

    @IsOptional()
    @IsEnum(NotificationType)
    type?: NotificationType = NotificationType.SYSTEM;
}

export class UpdateNotificationDto extends PartialType(CreateNotificationDto) {}
