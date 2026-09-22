import { Injectable } from '@nestjs/common';

import { AnalyticsEventType, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(params: {
    type: AnalyticsEventType;
    userId?: string;
    orderId?: string;
    productId?: string;
    amountInCents?: number;
    quantity?: number;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.analyticsEvent.create({
      data: {
        type: params.type,
        userId: params.userId,
        orderId: params.orderId,
        productId: params.productId,
        amountInCents: params.amountInCents,
        quantity: params.quantity,
        metadata: params.metadata,
      },
    });
  }

  async getDashboard(from: Date, to: Date) {
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        occurredAt: {
          gte: from,
          lte: to,
        },
      },
    });

    let totalOrders = 0;
    let successfulOrders = 0;
    let cancelledOrders = 0;
    let revenueInCents = 0;
    let paymentFailures = 0;
    let productsSold = 0;
    let usersRegistered = 0;

    for (const event of events) {
      switch (event.type) {
        case AnalyticsEventType.ORDER_CREATED:
          totalOrders++;
          break;

        case AnalyticsEventType.PAYMENT_SUCCEEDED:
          successfulOrders++;

          revenueInCents += event.amountInCents ?? 0;

          break;

        case AnalyticsEventType.PAYMENT_FAILED:
          paymentFailures++;
          break;

        case AnalyticsEventType.ORDER_CANCELLED:
          cancelledOrders++;
          break;

        case AnalyticsEventType.ORDER_DELIVERED:
          productsSold += event.quantity ?? 0;

          break;

        case AnalyticsEventType.USER_REGISTERED:
          usersRegistered++;
          break;
      }
    }

    return {
      period: {
        from,
        to,
      },

      metrics: {
        totalOrders,
        successfulOrders,
        cancelledOrders,
        revenueInCents,
        paymentFailures,
        productsSold,
        usersRegistered,
      },
    };
  }

  async getSalesByProduct(from: Date, to: Date) {
    return this.prisma.analyticsEvent.groupBy({
      by: ['productId'],

      where: {
        type: AnalyticsEventType.ORDER_CREATED,

        occurredAt: {
          gte: from,
          lte: to,
        },

        productId: {
          not: null,
        },
      },

      _sum: {
        quantity: true,
        amountInCents: true,
      },
    });
  }
}
