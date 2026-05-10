import {
    Controller,
    DefaultValuePipe,
    Get,
    Param,
    ParseIntPipe,
    Query,
} from '@nestjs/common';
import { RestaurantService } from './restaurant.service';

@Controller('restaurant')
export class RestaurantController {
    constructor(private readonly restaurantService: RestaurantService) {}

    @Get()
    async getAllRestauant(
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
        @Query('name', new DefaultValuePipe('')) name: string,
        @Query('phone', new DefaultValuePipe('')) phone: string,
    ) {
        return this.restaurantService.getAllRestaurants(
            limit,
            offset,
            name,
            phone,
        );
    }

    @Get('/detail/:restaurantId')
    async getRestaurantDetail(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantInDetail(restaurantId);
    }

    @Get('/menu/:restaurantId')
    async getRestaurantMenu(
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        return this.restaurantService.getRestaurantMenu(restaurantId);
    }
}
