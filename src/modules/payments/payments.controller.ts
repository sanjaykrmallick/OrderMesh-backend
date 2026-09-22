import {
  BadRequestException,
  Controller,
  Headers,
  Param,
  Post,
  Req,
} from '@nestjs/common';

import { Request } from 'express';

import { Public } from '../../common/decorators/public.decorator';

import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Public()
  @Post('webhook/stripe')
  async stripeWebhook(
    @Headers('stripe-signature')
    signature: string,

    @Req()
    req: Request & {
      rawBody?: Buffer;
    },
  ) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!req.rawBody) {
      throw new BadRequestException('Raw request body is unavailable');
    }

    return this.paymentsService.handleStripeWebhook(
      req.rawBody,

      signature,
    );
  }

  @Post(':orderId/refund')
  async refund(
    @Param('orderId')
    orderId: string,

    @Req() req: any,
  ) {
    return this.paymentsService.refund(
      req.user.userId,

      orderId,
    );
  }
}
