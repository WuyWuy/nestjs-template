import { CreateAddressDto } from '@/modules/address/dto/address.dto';
import {
    IsOptional,
    IsString,
    MaxLength,
    ValidateNested,
} from 'class-validator';
import { IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class AddUserAddressDto {
    @ValidateNested()
    @Type(() => CreateAddressDto)
    address: CreateAddressDto;

    @IsString()
    title: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    addressDetail?: string;
}

export class UpdateUserAddressDto {
    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    @MaxLength(500)
    addressDetail?: string;
}

export class UpdateUserProfileDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsDateString()
    birthday?: string;
}
