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
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Role } from '@prisma/client';
import { RolesGuard } from '@/bases/guards/role.guard';
import { Roles } from '@/bases/decorators/role.decorators';
import type { Request } from 'express';
import { CreateCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

@ApiTags('08. Cart')
@ApiBearerAuth()
@Roles(Role.CUSTOMER)
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) {}
    @ApiOperation({ summary: 'Xem giỏ hàng hiện tại' })
    @Get()
    async getCartProducts(@Req() req: Request) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.cartService.getCart(userId);
    }

    @ApiOperation({ summary: 'Thêm món vào giỏ hàng' })
    @ApiBody({
        type: CreateCartItemDto,
        examples: {
            example: {
                summary: 'Thêm món với size',
                value: {
                    foodId: 1,
                    quantity: 2,
                    foodSizeId: 1,
                    fullText: 'Ít hành',
                },
            },
        },
    })
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

    @ApiOperation({ summary: 'Cập nhật một món trong giỏ' })
    @ApiBody({
        type: UpdateCartItemDto,
        examples: {
            example: {
                summary: 'Đổi số lượng món',
                value: {
                    quantity: 3,
                },
            },
        },
    })
    @Patch('/:cartItemId')
    async updateCartItem(
        @Req() req: Request,
        @Param('cartItemId', ParseIntPipe) cartItemId: number,
        @Body() data: UpdateCartItemDto,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.cartService.updateCartItem(userId, cartItemId, data);
    }
    @ApiOperation({ summary: 'Xóa các món của một nhà hàng khỏi giỏ' })
    @Delete('/restaurant/:restaurantId')
    async clearCartByRestaurant(
        @Req() req: Request,
        @Param('restaurantId', ParseIntPipe) restaurantId: number,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.cartService.clearCartByRestaurant(
            userId,
            restaurantId,
        );
    }

    @ApiOperation({ summary: 'Xóa một món trong giỏ' })
    @Delete('/:cartItemId')
    async deleteCartItem(
        @Req() req: Request,
        @Param('cartItemId', ParseIntPipe) cartItemId: number,
    ) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.cartService.deleteCartById(userId, cartItemId);
    }

    @ApiOperation({ summary: 'Xóa toàn bộ giỏ hàng' })
    @Delete()
    async clearCart(@Req() req: Request) {
        const userId = Number((req.user as { id?: number })?.id);
        return await this.cartService.clearCart(userId);
    }
}
