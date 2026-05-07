import { Module } from "@nestjs/common";
import { AddressModule } from "../address/address.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
    imports: [AddressModule], 
    controllers: [OrderController], 
    providers: [OrderService], 
    exports: [OrderService]
}) 
export class OrderModule { }