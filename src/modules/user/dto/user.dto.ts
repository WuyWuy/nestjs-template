import { CreateAddressDto } from '@/modules/address/dto/address.dto';
import { IsString, ValidateNested } from 'class-validator';
import { IsOptional , IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class AddUserAddressDto {
    @ValidateNested()
    @Type(() => CreateAddressDto)
    address: CreateAddressDto;
    @IsString()
    title: string;
}

export class UpdateUserProfileDto{
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
