import { CreateAddressDto } from "@/modules/address/dto/address.dto"
import { IsString, ValidateNested } from "class-validator"
import { Type } from "class-transformer"

export class AddUserAddressDto   
{
    @ValidateNested() 
    @Type(() => CreateAddressDto)
    address: CreateAddressDto 
    @IsString() 
    title : string 
}