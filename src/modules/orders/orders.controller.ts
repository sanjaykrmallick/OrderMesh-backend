import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { OrdersService } from './orders.service';

import { CheckoutDto } from './dto/checkout.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';

@ApiTags('Orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @ApiOperation({
    summary: 'Create order from current cart',
  })
  checkout(@Req() req: any, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get current user orders',
  })
  findMyOrders(@Req() req: any, @Query() query: OrdersQueryDto) {
    return this.ordersService.findMyOrders(req.user.userId, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get order by ID',
  })
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.ordersService.findOne(req.user.userId, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Cancel order',
  })
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.ordersService.cancel(req.user.userId, id);
  }
}
