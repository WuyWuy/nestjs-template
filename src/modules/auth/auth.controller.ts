import {
    // Body,
    Controller,
    Get,
    // HttpCode,
    // HttpStatus,
    // Post,
    // Query,
    // Req,
    // UseGuards,
} from '@nestjs/common';
// import { RegisterData } from './dto/auth.dto';
import { AuthService } from './auth.service';
// import { LocalAuthGuard } from './local-auth.guard';
// import type { Request } from 'express';
// import { Roles } from '@/bases/decorators/role.decorators';
// import { Role } from '@prisma/client';
// import { RolesGuard } from '@/bases/guards/role.guard';
// import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}
    @Get()
    async sendOtp() {
        const responseData = await this.authService.sendOtp('+84941422097');
        return responseData;
    }
}
