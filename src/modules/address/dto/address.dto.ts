import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAddressDto {
    @IsString()
    title: string;
    @IsNumber()
    latitude: number;
    @IsNumber()
    longitude: number;
    @IsString()
    @IsOptional() 
    fullText: string;
}
export class FindAddressDto {
    @IsNumber()
    latitude: number;
    @IsNumber()
    longitude: number;
}
