import { CreateAddressDto } from '@/modules/address/dto/address.dto';
import { IsString, ValidateNested } from 'class-validator';
import { IsOptional , IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
export class AddUserAddressDto {
    @ValidateNested()
    @Type(() => CreateAddressDto)
    address: CreateAddressDto;
    @IsString()
    title: string;
}
export class UpdateUserAddressDto extends PartialType(AddUserAddressDto) {} 
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
