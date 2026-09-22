import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module';

import { PaymentsController } from './payments.controller';

import { PaymentsService } from './payments.service';

import { StripeGateway } from './gateways/stripe.gateway';

import { PaymentWebhookEventService } from './webhooks/payment-webhook-event.service';

@Module({
  imports: [InventoryModule],

  controllers: [PaymentsController],

  providers: [PaymentsService, StripeGateway, PaymentWebhookEventService],

  exports: [PaymentsService],
})
export class PaymentsModule {}
