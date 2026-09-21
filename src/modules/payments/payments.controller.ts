import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';

import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PaymentsService } from './payments.service';
import { PaymentActionDto } from './dto/payment-action.dto';

@ApiTags('Payments')
@ApiBearerAuth('access-token')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get(':orderId')
  @ApiOperation({
    summary: 'Get payment for order',
  })
  getPayment(@Req() req: any, @Param('orderId') orderId: string) {
    return this.paymentsService.getPayment(req.user.userId, orderId);
  }

  @Post(':orderId/pay')
  @ApiOperation({
    summary: 'Process payment',
  })
  pay(
    @Req() req: any,
    @Param('orderId') orderId: string,
    @Body() dto: PaymentActionDto,
  ) {
    return this.paymentsService.pay(req.user.userId, orderId, dto);
  }

  @Post(':orderId/fail')
  @ApiOperation({
    summary: 'Mark payment as failed',
  })
  fail(@Req() req: any, @Param('orderId') orderId: string) {
    return this.paymentsService.fail(req.user.userId, orderId);
  }

  @Post(':orderId/refund')
  @ApiOperation({
    summary: 'Refund payment',
  })
  refund(@Req() req: any, @Param('orderId') orderId: string) {
    return this.paymentsService.refund(req.user.userId, orderId);
  }
}
