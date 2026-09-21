import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CartService } from './cart.service';

import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('Cart')
@ApiBearerAuth('access-token')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current user cart',
  })
  getCart(@Req() req: any) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post('items')
  @ApiOperation({
    summary: 'Add product to cart',
  })
  addItem(@Req() req: any, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(req.user.userId, dto);
  }

  @Patch('items/:productId')
  @ApiOperation({
    summary: 'Update cart item quantity',
  })
  updateItem(
    @Req() req: any,
    @Param('productId')
    productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(req.user.userId, productId, dto);
  }

  @Delete('items/:productId')
  @ApiOperation({
    summary: 'Remove product from cart',
  })
  removeItem(
    @Req() req: any,
    @Param('productId')
    productId: string,
  ) {
    return this.cartService.removeItem(req.user.userId, productId);
  }

  @Delete()
  @ApiOperation({
    summary: 'Clear cart',
  })
  clearCart(@Req() req: any) {
    return this.cartService.clearCart(req.user.userId);
  }
}
