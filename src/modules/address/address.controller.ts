import { Body, Controller, Post } from "@nestjs/common";
import { CreateAddressDto } from "./dto/address.dto";
import { AddressService } from "./address.service";

@Controller("address") 
export class AddressController 
{
    constructor(
        private readonly addressService : AddressService
    ) {} 
    @Post() 
    async createAddress(@Body() createAddressData : CreateAddressDto) 
    {
        const responseData = await this.addressService.createAddress(createAddressData) 
        console.log("create address" , responseData) 
        return responseData
    }
}