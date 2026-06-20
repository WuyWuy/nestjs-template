import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Req,
    UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '@prisma/client';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import type { Request } from 'express';
import { CreateCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

@Roles(Role.CUSTOMER)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) {}
    @Get()
    async getCartProducts(@Req() req: Request) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.cartService.getCart(userId);
    }

    @Post()
    async pushCartItem(
        @Req() req: Request,
        @Body() createCartItem: CreateCartItemDto,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        const cartItem = await this.cartService.pushCartItem(
            userId,
            createCartItem,
        );
        return cartItem;
    }

    @Patch('/:cartItemId')
    async updateCartItem(
        @Req() req: Request,
        @Param('cartItemId', ParseIntPipe) cartItemId: number,
        @Body() data: UpdateCartItemDto,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.cartService.updateCartItem(userId, cartItemId, data);
    }

    @Delete('/:cartItemId')
    async deleteCartItem(
        @Req() req: Request,
        @Param('cartItemId', ParseIntPipe) cartItemId: number,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.cartService.deleteCartById(userId, cartItemId);
    }

    @Delete()
    async clearCart(@Req() req: Request) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.cartService.clearCart(userId);
    }
}
