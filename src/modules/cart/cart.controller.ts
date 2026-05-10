import {
    Body,
    Controller,
    DefaultValuePipe,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '@prisma/client';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import type { Request } from 'express';
import { CreateCartItemDto } from './dto/cart.dto';

@Roles(Role.CUSTOMER)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) {}
    @Get()
    async getCartProducts(
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
    ) {
        const response = await this.cartService.getAllProducts(limit, offset);
        return response;
    }
    @Post()
    async pushCartItem(
        @Req() req: Request,
        @Body() createCartItem: CreateCartItemDto,
    ) {
        const userId = (req.user as any).id;
        console.log(userId);
        const cartItem = await this.cartService.pushCartItem(
            Number(userId),
            createCartItem,
        );
        return cartItem;
    }
    @Delete('/:cartItemId')
    async deleteCartItem(
        @Param('cartItemId', ParseIntPipe) cartItemId: number,
    ) {
        return await this.cartService.deleteCartById(Number(cartItemId));
    }
}
