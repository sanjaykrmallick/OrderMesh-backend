import { Injectable } from '@nestjs/common';

import {
  PaymentProvider,
  PaymentWebhookEventStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PaymentWebhookEventService {
  constructor(private readonly prisma: PrismaService) {}

  async createIfNotExists(params: {
    provider: PaymentProvider;
    eventId: string;
    eventType: string;
    providerPaymentId?: string;
    payload?: Prisma.InputJsonValue;
  }) {
    try {
      const event = await this.prisma.paymentWebhookEvent.create({
        data: {
          provider: params.provider,
          eventId: params.eventId,
          eventType: params.eventType,
          providerPaymentId: params.providerPaymentId,
          payload: params.payload,
        },
      });

      return {
        created: true,
        event,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.paymentWebhookEvent.findUnique({
          where: {
            eventId: params.eventId,
          },
        });

        return {
          created: false,
          event: existing,
        };
      }

      throw error;
    }
  }

  /**
   * Atomically claim an event.
   *
   * Only ONE request should be allowed
   * to move RECEIVED -> PROCESSING.
   */
  async claimEvent(eventId: string) {
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);

    const result = await this.prisma.paymentWebhookEvent.updateMany({
      where: {
        eventId,

        OR: [
          {
            status: PaymentWebhookEventStatus.RECEIVED,
          },
          {
            status: PaymentWebhookEventStatus.FAILED,
          },
          {
            status: PaymentWebhookEventStatus.PROCESSING,
            processingStartedAt: {
              lt: staleThreshold,
            },
          },
        ],
      },

      data: {
        status: PaymentWebhookEventStatus.PROCESSING,
        processingStartedAt: new Date(),
        errorMessage: null,
      },
    });

    return result.count > 0;
  }

  /**
   * Mark webhook successfully processed.
   */
  async markProcessed(eventId: string) {
    await this.prisma.paymentWebhookEvent.update({
      where: {
        eventId,
      },

      data: {
        status: PaymentWebhookEventStatus.PROCESSED,
        processedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  /**
   * Mark webhook processing failed.
   *
   * Stripe can retry the webhook later.
   */
  async markFailed(
    eventId: string,

    error: unknown,
  ) {
    const message =
      error instanceof Error ? error.message : 'Webhook processing failed';

    await this.prisma.paymentWebhookEvent.update({
      where: {
        eventId,
      },

      data: {
        status: PaymentWebhookEventStatus.FAILED,

        errorMessage: message,
      },
    });
  }
}
