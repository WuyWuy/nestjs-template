import { IsInt, IsNotEmpty, Min } from "class-validator";

export class CreateCartItemDto {
    @IsInt() 
    @IsNotEmpty() 
    foodId : number;  

    @IsInt() 
    @IsNotEmpty() 
    @Min(0) 
    quantity : number; 
}
