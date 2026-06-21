import { Module, NestModule, MiddlewareConsumer, RequestMethod } from "@nestjs/common";
import { RestaurantController } from "./restaurant.controller";
import { RestaurantService } from "./restaurant.service";
import { AdminRoleMiddleware } from "@/bases/middlewares/admin-role.middleware";

@Module({
    imports: [], 
    exports: [], 
    providers: [RestaurantService], 
    controllers: [RestaurantController] 
}) 
export class RestaurantModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // Admin-only routes: protect all /restaurant/admin/* routes.
        // Áp dụng middleware này cho các endpoint admin của restaurant.
        consumer
            .apply(AdminRoleMiddleware)
            .forRoutes(
                { path: 'restaurant/admin/(.*)', method: RequestMethod.GET },
                { path: 'restaurant/admin/(.*)', method: RequestMethod.PUT },
            );
    }
}

