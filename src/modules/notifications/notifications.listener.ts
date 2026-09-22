import { Injectable, Logger } from '@nestjs/common';

import { NotificationType } from '@prisma/client';

import { OnEvent } from '@nestjs/event-emitter';

import { EVENTS } from '../../common/events/events.constants';

import type {
  OrderEventPayload,
  PaymentEventPayload,
} from '../../common/events/event-payloads';

import { NotificationsGateway } from './notifications.gateway';

import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * PAYMENT SUCCESS
   */
  @OnEvent(EVENTS.PAYMENT_SUCCEEDED, {
    async: true,
  })
  async handlePaymentSucceeded(payload: PaymentEventPayload) {
    this.logger.log(`Payment succeeded: ${payload.paymentId}`);

    const notification = await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.PAYMENT_SUCCESS,
      title: 'Payment successful',
      message: `Your payment for order ${payload.orderId} was successful.`,
      entityType: 'ORDER',
      entityId: payload.orderId,
      metadata: {
        paymentId: payload.paymentId,
        paymentAttemptId: payload.paymentAttemptId,
        amountInCents: payload.amountInCents,
        provider: payload.provider,
        providerPaymentId: payload.providerPaymentId,
      },
    });

    /**
     * Send realtime notification.
     */
    this.notificationsGateway.emitNotification(payload.userId, notification);

    /**
     * Also send a payment-specific event.
     */
    this.notificationsGateway.emitPaymentSuccess(payload.userId, {
      orderId: payload.orderId,
      paymentId: payload.paymentId,
      amountInCents: payload.amountInCents,
      status: 'SUCCESS',
    });
  }

  /**
   * PAYMENT FAILED
   */
  @OnEvent(EVENTS.PAYMENT_FAILED, {
    async: true,
  })
  async handlePaymentFailed(payload: PaymentEventPayload) {
    this.logger.warn(`Payment failed: ${payload.paymentId}`);

    const notification = await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.PAYMENT_FAILED,
      title: 'Payment failed',
      message: `Payment for order ${payload.orderId} failed. Please try again.`,
      entityType: 'ORDER',
      entityId: payload.orderId,
      metadata: {
        paymentId: payload.paymentId,
        paymentAttemptId: payload.paymentAttemptId,
        failureCode: payload.failureCode,
        failureMessage: payload.failureMessage,
      },
    });

    this.notificationsGateway.emitNotification(payload.userId, notification);

    this.notificationsGateway.emitPaymentFailed(payload.userId, {
      orderId: payload.orderId,
      paymentId: payload.paymentId,
      status: 'FAILED',
      failureCode: payload.failureCode,
      failureMessage: payload.failureMessage,
    });
  }

  /**
   * ORDER CREATED
   */
  @OnEvent(EVENTS.ORDER_CREATED, {
    async: true,
  })
  async handleOrderCreated(payload: OrderEventPayload) {
    const notification = await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.ORDER_CREATED,
      title: 'Order placed',
      message: `Your order ${payload.orderNumber} has been placed successfully.`,
      entityType: 'ORDER',
      entityId: payload.orderId,
      metadata: {
        orderNumber: payload.orderNumber,
        totalAmountInCents: payload.totalAmountInCents,
      },
    });

    this.notificationsGateway.emitNotification(payload.userId, notification);

    this.notificationsGateway.emitOrderUpdate(payload.userId, {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      status: 'CREATED',
    });
  }

  /**
   * ORDER CANCELLED
   */
  @OnEvent(EVENTS.ORDER_CANCELLED, {
    async: true,
  })
  async handleOrderCancelled(payload: OrderEventPayload) {
    const notification = await this.notificationsService.create({
      userId: payload.userId,
      type: NotificationType.ORDER_CANCELLED,
      title: 'Order cancelled',
      message: `Your order ${payload.orderNumber} has been cancelled.`,
      entityType: 'ORDER',
      entityId: payload.orderId,
      metadata: {
        orderNumber: payload.orderNumber,
      },
    });

    this.notificationsGateway.emitNotification(payload.userId, notification);

    this.notificationsGateway.emitOrderUpdate(payload.userId, {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      status: 'CANCELLED',
    });
  }
}
