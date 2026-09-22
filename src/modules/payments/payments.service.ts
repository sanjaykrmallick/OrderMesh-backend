import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { EventEmitter2 } from '@nestjs/event-emitter';
import { EVENTS } from '../../common/events/events.constants';

import { PrismaService } from '../../database/prisma.service';

import { InventoryService } from '../inventory/inventory.service';

import { StripeGateway } from './gateways/stripe.gateway';

import {
  PaymentGateway,
  PaymentWebhookResult,
} from './gateways/payment-gateway.interface';

import { PaymentWebhookEventService } from './webhooks/payment-webhook-event.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly stripeGateway: StripeGateway,
    private readonly webhookEventService: PaymentWebhookEventService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Select payment provider.
   *
   * STRIPE
   * RAZORPAY
   * PAYPAL
   */
  private getGateway(provider: PaymentProvider): PaymentGateway {
    switch (provider) {
      case PaymentProvider.STRIPE:
        return this.stripeGateway;

      default:
        throw new ConflictException(
          `Payment provider ${provider} is not supported`,
        );
    }
  }

  /**
   * Create provider-side payment.
   */
  async initializePayment(
    orderId: string,
    paymentId: string,
    attemptId: string,
  ) {
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: {
        id: attemptId,
      },
      include: {
        payment: {
          include: {
            order: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFoundException('Payment attempt not found');
    }

    if (attempt.payment.orderId !== orderId) {
      throw new ConflictException('Payment does not belong to order');
    }

    /**
     * Already initialized.
     */
    if (attempt.providerPaymentId) {
      return {
        paymentAttemptId: attempt.id,
        provider: attempt.provider,
        providerPaymentId: attempt.providerPaymentId,
        clientSecret: this.getClientSecretFromMetadata(attempt.metadata),
        status: attempt.status,
      };
    }

    const gateway = this.getGateway(attempt.provider);

    const result = await gateway.createPayment({
      amountInCents: attempt.amountInCents,
      currency: process.env.STRIPE_CURRENCY ?? 'inr',
      orderId,
      paymentId,
      attemptId,
      customerEmail: attempt.payment.order.user.email,
      idempotencyKey: attempt.idempotencyKey,
      metadata: {
        orderId,
        paymentId,
        attemptId,
      },
    });

    /**
     * Save provider payment ID and
     * client secret.
     */
    const updatedAttempt = await this.prisma.paymentAttempt.update({
      where: {
        id: attempt.id,
      },

      data: {
        providerPaymentId: result.providerPaymentId,
        status:
          result.status === 'SUCCEEDED'
            ? PaymentAttemptStatus.SUCCEEDED
            : result.status === 'PROCESSING'
              ? PaymentAttemptStatus.PROCESSING
              : PaymentAttemptStatus.CREATED,

        metadata: {
          clientSecret: result.clientSecret ?? null,
        },
      },
    });

    return {
      paymentAttemptId: updatedAttempt.id,
      provider: updatedAttempt.provider,
      providerPaymentId: updatedAttempt.providerPaymentId,
      clientSecret: result.clientSecret,
      status: updatedAttempt.status,
    };
  }

  /**
   * Stripe webhook.
   */
  async handleStripeWebhook(payload: Buffer, signature: string) {
    const result = await this.stripeGateway.parseWebhook(payload, signature);

    const webhookEvent = await this.webhookEventService.createIfNotExists({
      provider: PaymentProvider.STRIPE,
      eventId: result.eventId,
      eventType: result.eventType,
      providerPaymentId: result.providerPaymentId,
      payload: result.raw as Prisma.InputJsonValue,
    });

    if (webhookEvent.event && webhookEvent.event.status === 'PROCESSED') {
      return {
        received: true,
        duplicate: true,
        status: 'already_processed',
      };
    }

    if (webhookEvent.event && webhookEvent.event.status === 'PROCESSING') {
      return {
        received: true,
        duplicate: true,
        status: 'processing',
      };
    }

    const claimed = await this.webhookEventService.claimEvent(result.eventId);

    if (!claimed) {
      return {
        received: true,
        duplicate: true,
        status: 'already_claimed',
      };
    }

    try {
      const response = await this.processWebhook(
        PaymentProvider.STRIPE,
        result,
      );

      await this.webhookEventService.markProcessed(result.eventId);

      return response;
    } catch (error) {
      await this.webhookEventService.markFailed(result.eventId, error);

      throw error;
    }
  }

  /**
   * Provider-independent webhook processing.
   */
  private async processWebhook(
    provider: PaymentProvider,
    result: PaymentWebhookResult,
  ) {
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      /**
       * Find payment attempt.
       */
      const attempt = await tx.paymentAttempt.findFirst({
        where: {
          provider,
          providerPaymentId: result.providerPaymentId,
        },

        include: {
          payment: {
            include: {
              order: {
                include: {
                  items: true,
                },
              },
            },
          },
        },
      });

      if (!attempt) {
        throw new NotFoundException('Payment attempt not found');
      }

      if (attempt.status === PaymentAttemptStatus.SUCCEEDED) {
        return {
          received: true,
          alreadyProcessed: true,
        };
      }

      /**
       * =====================================
       * PROCESSING
       * =====================================
       */
      if (result.status === 'PROCESSING') {
        const updateResult = await tx.paymentAttempt.updateMany({
          where: {
            id: attempt.id,
            status: {
              in: [
                PaymentAttemptStatus.CREATED,
                PaymentAttemptStatus.PROCESSING,
              ],
            },
          },

          data: {
            status: PaymentAttemptStatus.PROCESSING,
            lastWebhookEventId: result.eventId,
          },
        });

        if (updateResult.count === 0) {
          return {
            received: true,
            concurrentUpdate: true,
          };
        }

        return {
          received: true,
          status: 'PROCESSING',
        };
      }

      /**
       * =====================================
       * SUCCESS
       * =====================================
       */
      if (result.status === 'SUCCEEDED') {
        const updateResult = await tx.paymentAttempt.updateMany({
          where: {
            id: attempt.id,
            status: {
              in: [
                PaymentAttemptStatus.CREATED,
                PaymentAttemptStatus.PROCESSING,
              ],
            },
          },

          data: {
            status: PaymentAttemptStatus.SUCCEEDED,
            lastWebhookEventId: result.eventId,
          },
        });

        if (updateResult.count === 0) {
          return {
            received: true,
            concurrentUpdate: true,
          };
        }

        await tx.payment.update({
          where: {
            id: attempt.paymentId,
          },

          data: {
            status: PaymentStatus.SUCCESS,
          },
        });

        await tx.order.update({
          where: {
            id: attempt.payment.orderId,
          },

          data: {
            status: OrderStatus.PAID,
          },
        });

        return {
          received: true,
          status: 'SUCCESS',
          eventType: EVENTS.PAYMENT_SUCCEEDED,
          event: {
            orderId: attempt.payment.orderId,
            userId: attempt.payment.order.userId,
            paymentId: attempt.paymentId,
            paymentAttemptId: attempt.id,
            amountInCents: attempt.amountInCents,
            provider,
            providerPaymentId: attempt.providerPaymentId ?? undefined,
          },
        };
      }

      /**
       * =====================================
       * FAILED
       * =====================================
       */
      if (result.status === 'FAILED') {
        const updateResult = await tx.paymentAttempt.updateMany({
          where: {
            id: attempt.id,
            status: {
              in: [
                PaymentAttemptStatus.CREATED,
                PaymentAttemptStatus.PROCESSING,
              ],
            },
          },

          data: {
            status: PaymentAttemptStatus.FAILED,
            lastWebhookEventId: result.eventId,
            failureCode: result.failureCode,
            failureMessage: result.failureMessage,
          },
        });

        if (updateResult.count === 0) {
          return {
            received: true,
            concurrentUpdate: true,
          };
        }

        for (const item of attempt.payment.order.items) {
          await this.inventoryService.releaseWithinTransaction(
            tx,
            item.productId,
            item.quantity,
          );
        }

        await tx.payment.update({
          where: {
            id: attempt.paymentId,
          },

          data: {
            status: PaymentStatus.FAILED,
          },
        });

        await tx.order.update({
          where: {
            id: attempt.payment.orderId,
          },

          data: {
            status: OrderStatus.CANCELLED,
          },
        });

        return {
          received: true,
          status: 'FAILED',
          eventType: EVENTS.PAYMENT_FAILED,

          event: {
            orderId: attempt.payment.orderId,
            userId: attempt.payment.order.userId,
            paymentId: attempt.paymentId,
            paymentAttemptId: attempt.id,
            amountInCents: attempt.amountInCents,
            provider,
            providerPaymentId: attempt.providerPaymentId ?? undefined,
            failureCode: result.failureCode,
            failureMessage: result.failureMessage,
          },
        };
      }

      /**
       * =====================================
       * CANCELLED
       * =====================================
       */
      if (result.status === 'CANCELLED') {
        const updateResult = await tx.paymentAttempt.updateMany({
          where: {
            id: attempt.id,
            status: {
              in: [
                PaymentAttemptStatus.CREATED,
                PaymentAttemptStatus.PROCESSING,
              ],
            },
          },

          data: {
            status: PaymentAttemptStatus.CANCELLED,
            lastWebhookEventId: result.eventId,
          },
        });

        if (updateResult.count === 0) {
          return {
            received: true,
            concurrentUpdate: true,
          };
        }

        /**
         * Release inventory.
         */
        for (const item of attempt.payment.order.items) {
          await this.inventoryService.releaseWithinTransaction(
            tx,
            item.productId,
            item.quantity,
          );
        }

        await tx.payment.update({
          where: {
            id: attempt.paymentId,
          },

          data: {
            status: PaymentStatus.FAILED,
          },
        });

        await tx.order.update({
          where: {
            id: attempt.payment.orderId,
          },

          data: {
            status: OrderStatus.CANCELLED,
          },
        });

        return {
          received: true,
          status: 'CANCELLED',
        };
      }

      return {
        received: true,
        ignored: true,
      };
    });

    if (transactionResult.event) {
      this.eventEmitter.emit(
        transactionResult.eventType,
        transactionResult.event,
      );
    }

    return transactionResult;
  }

  /**
   * Refund successful payment.
   */
  async refund(
    userId: string,

    orderId: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        order: {
          id: orderId,

          userId,
        },
      },

      include: {
        order: true,

        attempts: {
          where: {
            status: PaymentAttemptStatus.SUCCEEDED,
          },

          orderBy: {
            createdAt: 'desc',
          },

          take: 1,
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new ConflictException('Payment is not successful');
    }

    const attempt = payment.attempts[0];

    if (!attempt?.providerPaymentId) {
      throw new ConflictException('Provider payment ID not found');
    }

    const gateway = this.getGateway(attempt.provider);

    await gateway.refund(
      attempt.providerPaymentId,

      payment.amountInCents,
    );

    /**
     * We update local state only after
     * provider accepts the refund.
     *
     * In production, you can also make
     * refund webhook the final source of truth.
     */
    await this.prisma.$transaction(async (tx) => {
      await tx.paymentAttempt.update({
        where: {
          id: attempt.id,
        },

        data: {
          status: PaymentAttemptStatus.REFUNDED,
        },
      });

      await tx.payment.update({
        where: {
          id: payment.id,
        },

        data: {
          status: PaymentStatus.REFUNDED,
        },
      });

      await tx.order.update({
        where: {
          id: orderId,
        },

        data: {
          status: OrderStatus.CANCELLED,
        },
      });
    });

    return {
      message: 'Refund initiated successfully',

      orderId,
    };
  }

  private getClientSecretFromMetadata(
    metadata: Prisma.JsonValue | null,
  ): string | undefined {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return undefined;
    }

    const value = (metadata as Record<string, unknown>).clientSecret;

    return typeof value === 'string' ? value : undefined;
  }
}
