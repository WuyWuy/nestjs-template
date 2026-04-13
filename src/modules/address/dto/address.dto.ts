import { IsNumber, IsString } from "class-validator";

export class CreateAddressDto 
{
    @IsString() 
    title : string; 
    @IsNumber() 
    latitude : number; 
    @IsNumber() 
    longitude : number; 
    @IsString() 
    fullText: string 
}