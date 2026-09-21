import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { OrderStatus, PaymentStatus } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

import { PaymentActionDto } from './dto/payment-action.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async getPayment(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },

      include: {
        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.payment) {
      throw new NotFoundException('Payment not found');
    }

    return order.payment;
  }

  async pay(userId: string, orderId: string, dto: PaymentActionDto) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },

      include: {
        payment: true,
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.payment) {
      throw new NotFoundException('Payment not found');
    }

    if (order.payment.status === PaymentStatus.SUCCESS) {
      return {
        message: 'Payment already successful',
        payment: order.payment,
      };
    }

    if (order.status !== OrderStatus.PAYMENT_PENDING) {
      throw new ConflictException('Order is not awaiting payment');
    }

    /*
     * In production, this is where we call
     * Stripe/Razorpay/etc.
     *
     * For now we simulate success.
     */
    const transactionId =
      dto.transactionId ||
      `TXN-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: {
          orderId,
        },

        data: {
          status: PaymentStatus.SUCCESS,

          transactionId,
        },
      });

      const updatedOrder = await tx.order.update({
        where: {
          id: orderId,
        },

        data: {
          status: OrderStatus.PAID,
        },
      });

      return {
        payment,
        order: updatedOrder,
      };
    });

    return result;
  }

  async fail(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },

      include: {
        payment: true,
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.payment) {
      throw new NotFoundException('Payment not found');
    }

    if (order.payment.status === PaymentStatus.SUCCESS) {
      throw new ConflictException(
        'Successful payment cannot be marked as failed',
      );
    }

    /*
     * Payment failed.
     *
     * Release all reserved inventory.
     *
     * Do this in the SAME transaction as
     * payment/order status changes.
     */
    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await this.inventoryService.releaseWithinTransaction(
          tx,
          item.productId,
          item.quantity,
        );
      }

      await tx.payment.update({
        where: {
          orderId,
        },

        data: {
          status: PaymentStatus.FAILED,
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
      message: 'Payment failed and inventory released',
      orderId,
    };
  }

  async refund(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },

      include: {
        payment: true,
        items: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.payment) {
      throw new NotFoundException('Payment not found');
    }

    if (order.payment.status !== PaymentStatus.SUCCESS) {
      throw new ConflictException('Only successful payments can be refunded');
    }

    await this.prisma.$transaction(async (tx) => {
      /*
       * At this point the order has already
       * been paid.
       *
       * For a simple cancellation/refund
       * before fulfillment, return the
       * reserved stock.
       */
      for (const item of order.items) {
        await this.inventoryService.releaseWithinTransaction(
          tx,
          item.productId,
          item.quantity,
        );
      }

      await tx.payment.update({
        where: {
          orderId,
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
      message: 'Payment refunded successfully',
      orderId,
    };
  }
}
