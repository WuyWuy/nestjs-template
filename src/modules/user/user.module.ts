import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { AuthModule } from "../auth/auth.module";
import { AddressModule } from "../address/address.module";
import { AdminRoleMiddleware } from "@/bases/middlewares/admin-role.middleware";
@Module({
    imports: [AuthModule , AddressModule], 
    controllers: [UserController], 
    providers: [UserService], 
    exports: [UserService]
}) 
export class UserModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // Admin-only route: only users with the ADMIN role may access GET /user.
        // Đây là ví dụ áp dụng middleware cho các route chỉ dành cho admin.
        consumer
            .apply(AdminRoleMiddleware)
            .forRoutes({ path: 'user', method: RequestMethod.GET });
    }
}
