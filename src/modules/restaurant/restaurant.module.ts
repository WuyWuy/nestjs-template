import { Module } from "@nestjs/common";
import { RestaurantController } from "./restaurant.controller";
import { RestaurantService } from "./restaurant.service";
@Module({
    imports: [], 
    exports: [], 
    providers: [RestaurantService], 
    controllers: [RestaurantController] 
}) 
export class RestaurantModule { } 


