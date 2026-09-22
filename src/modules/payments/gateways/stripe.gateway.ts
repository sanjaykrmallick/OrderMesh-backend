import { BadRequestException, Injectable } from '@nestjs/common';

import Stripe from 'stripe';

import {
  CreatePaymentParams,
  PaymentGateway,
  PaymentGatewayResult,
  PaymentWebhookResult,
} from './payment-gateway.interface';

@Injectable()
export class StripeGateway implements PaymentGateway {
  private readonly stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(secretKey);
  }

  async createPayment(
    params: CreatePaymentParams,
  ): Promise<PaymentGatewayResult> {
    const paymentIntent = await this.stripe.paymentIntents.create(
      {
        amount: params.amountInCents,

        currency: params.currency,

        automatic_payment_methods: {
          enabled: true,
        },

        receipt_email: params.customerEmail,

        metadata: {
          orderId: params.orderId,

          paymentId: params.paymentId,

          attemptId: params.attemptId,

          ...(params.metadata ?? {}),
        },
      },

      {
        idempotencyKey: params.idempotencyKey,
      },
    );

    return {
      providerPaymentId: paymentIntent.id,

      clientSecret: paymentIntent.client_secret ?? undefined,

      status: this.mapPaymentIntentStatus(paymentIntent.status),

      raw: paymentIntent,
    };
  }

  async parseWebhook(
    payload: Buffer,

    signature: string,
  ): Promise<PaymentWebhookResult> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,

        signature,

        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    return {
      providerPaymentId: paymentIntent.id,

      eventId: event.id,

      eventType: event.type,

      status: this.mapWebhookStatus(event),

      failureCode: paymentIntent.last_payment_error?.code,

      failureMessage: paymentIntent.last_payment_error?.message,

      raw: event,
    };
  }

  async refund(
    providerPaymentId: string,
    amountInCents?: number,
  ): Promise<void> {
    await this.stripe.refunds.create({
      payment_intent: providerPaymentId,

      ...(amountInCents !== undefined
        ? {
            amount: amountInCents,
          }
        : {}),
    });
  }

  private mapPaymentIntentStatus(
    status: Stripe.PaymentIntent.Status,
  ): PaymentGatewayResult['status'] {
    switch (status) {
      case 'succeeded':
        return 'SUCCEEDED';

      case 'processing':
        return 'PROCESSING';

      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'CREATED';

      default:
        return 'FAILED';
    }
  }

  private mapWebhookStatus(
    event: Stripe.Event,
  ): PaymentWebhookResult['status'] {
    switch (event.type) {
      case 'payment_intent.succeeded':
        return 'SUCCEEDED';

      case 'payment_intent.processing':
        return 'PROCESSING';

      case 'payment_intent.payment_failed':
        return 'FAILED';

      case 'payment_intent.canceled':
        return 'CANCELLED';

      default:
        return 'PROCESSING';
    }
  }
}
