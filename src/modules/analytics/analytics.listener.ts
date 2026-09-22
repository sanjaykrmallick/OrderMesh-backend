import { Injectable } from '@nestjs/common';

import { AnalyticsEventType } from '@prisma/client';

import { OnEvent } from '@nestjs/event-emitter';

import { EVENTS } from '../../common/events/events.constants';

import type {
  OrderEventPayload,
  PaymentEventPayload,
} from '../../common/events/event-payloads';

import { AnalyticsService } from './analytics.service';

@Injectable()
export class AnalyticsListener {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @OnEvent(EVENTS.ORDER_CREATED)
  async orderCreated(payload: OrderEventPayload) {
    await this.analyticsService.track({
      type: AnalyticsEventType.ORDER_CREATED,
      userId: payload.userId,
      orderId: payload.orderId,
      amountInCents: payload.totalAmountInCents,
    });
  }

  @OnEvent(EVENTS.PAYMENT_SUCCEEDED)
  async paymentSucceeded(payload: PaymentEventPayload) {
    await this.analyticsService.track({
      type: AnalyticsEventType.PAYMENT_SUCCEEDED,
      userId: payload.userId,
      orderId: payload.orderId,
      amountInCents: payload.amountInCents,
      metadata: {
        provider: payload.provider,
        providerPaymentId: payload.providerPaymentId,
      },
    });
  }

  @OnEvent(EVENTS.PAYMENT_FAILED)
  async paymentFailed(payload: PaymentEventPayload) {
    await this.analyticsService.track({
      type: AnalyticsEventType.PAYMENT_FAILED,
      userId: payload.userId,
      orderId: payload.orderId,
      amountInCents: payload.amountInCents,
    });
  }

  @OnEvent(EVENTS.ORDER_CANCELLED)
  async orderCancelled(payload: OrderEventPayload) {
    await this.analyticsService.track({
      type: AnalyticsEventType.ORDER_CANCELLED,
      userId: payload.userId,
      orderId: payload.orderId,
    });
  }
}
