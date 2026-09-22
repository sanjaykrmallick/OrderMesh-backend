import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { InventoryService } from '../inventory/inventory.service';

import { PaymentsService } from '../payments/payments.service';

import { CheckoutDto } from './dto/checkout.dto';

import { OrdersQueryDto } from './dto/orders-query.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,

    private readonly inventoryService: InventoryService,

    private readonly paymentsService: PaymentsService,
  ) {}

  async checkout(
    userId: string,

    dto: CheckoutDto,
  ) {
    /**
     * Find cart first.
     */
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
      },

      include: {
        items: {
          include: {
            product: {
              include: {
                inventory: true,
              },
            },
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    /**
     * Validate cart.
     */
    for (const item of cart.items) {
      if (!item.product.isActive) {
        throw new ConflictException(`Product ${item.product.name} is inactive`);
      }

      if (!item.product.inventory) {
        throw new ConflictException(
          `Inventory unavailable for ${item.product.name}`,
        );
      }

      if (item.product.inventory.availableQuantity < item.quantity) {
        throw new ConflictException(
          `Insufficient inventory for ${item.product.name}`,
        );
      }
    }

    /**
     * Calculate amount from DB price.
     */
    const totalAmountInCents = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.product.priceInCents,

      0,
    );

    if (totalAmountInCents <= 0) {
      throw new BadRequestException('Invalid order amount');
    }

    const orderNumber = this.generateOrderNumber();

    /**
     * IMPORTANT:
     *
     * No Stripe call here.
     *
     * This transaction only touches MongoDB.
     */
    const result = await this.prisma.$transaction(async (tx) => {
      /**
       * Re-read cart inside transaction.
       *
       * This protects against a cart being
       * changed between the initial read
       * and transaction.
       */
      const currentCart = await tx.cart.findUnique({
        where: {
          id: cart.id,
        },

        include: {
          items: {
            include: {
              product: {
                include: {
                  inventory: true,
                },
              },
            },
          },
        },
      });

      if (!currentCart || currentCart.items.length === 0) {
        throw new BadRequestException('Cart is empty');
      }

      /**
       * Validate again inside transaction.
       */
      for (const item of currentCart.items) {
        if (!item.product.isActive) {
          throw new ConflictException(
            `Product ${item.product.name} is inactive`,
          );
        }

        if (!item.product.inventory) {
          throw new ConflictException(
            `Inventory unavailable for ${item.product.name}`,
          );
        }

        /**
         * This check is useful for a
         * better error message.
         *
         * The actual atomic protection
         * happens in reserveWithinTransaction().
         */
        if (item.product.inventory.availableQuantity < item.quantity) {
          throw new ConflictException(
            `Insufficient inventory for ${item.product.name}`,
          );
        }
      }

      const transactionTotal = currentCart.items.reduce(
        (sum, item) => sum + item.quantity * item.product.priceInCents,

        0,
      );

      /**
       * Reserve inventory.
       *
       * Atomic conditional update.
       */
      for (const item of currentCart.items) {
        await this.inventoryService.reserveWithinTransaction(
          tx,

          item.productId,

          item.quantity,
        );
      }

      /**
       * Create Order.
       */
      const order = await tx.order.create({
        data: {
          orderNumber,

          userId,

          totalAmountInCents: transactionTotal,

          status: OrderStatus.PAYMENT_PENDING,

          shippingAddress: dto.shippingAddress,

          items: {
            create: currentCart.items.map((item) => ({
              productId: item.productId,

              productName: item.product.name,

              sku: item.product.sku,

              quantity: item.quantity,

              unitPriceInCents: item.product.priceInCents,

              totalPriceInCents: item.quantity * item.product.priceInCents,
            })),
          },
        },

        include: {
          items: true,
        },
      });

      /**
       * Create Payment.
       */
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,

          amountInCents: transactionTotal,

          status: 'PENDING',
        },
      });

      /**
       * Create PaymentAttempt.
       *
       * This gives us an idempotency key
       * before calling Stripe.
       */
      const attempt = await tx.paymentAttempt.create({
        data: {
          paymentId: payment.id,

          provider: PaymentProvider.STRIPE,

          status: PaymentAttemptStatus.CREATED,

          amountInCents: transactionTotal,

          idempotencyKey: `order:${order.id}:payment:${payment.id}`,
        },
      });

      /**
       * IMPORTANT:
       *
       * Delete only the cart items that
       * participated in this checkout.
       *
       * Don't blindly delete all cart items.
       */
      await tx.cartItem.deleteMany({
        where: {
          id: {
            in: currentCart.items.map((item) => item.id),
          },
        },
      });

      return {
        order,

        payment,

        attempt,
      };
    });

    /**
     * Mongo transaction has committed.
     *
     * NOW call Stripe.
     */
    const payment = await this.paymentsService.initializePayment(
      result.order.id,

      result.payment.id,

      result.attempt.id,
    );

    return {
      order: result.order,

      payment,
    };
  }

  async findMyOrders(
    userId: string,

    query: OrdersQueryDto,
  ) {
    const page = query.page ?? 1;

    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      userId,
    };

    if (query.status) {
      where.status = query.status;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,

        skip,

        take: limit,

        orderBy: {
          createdAt: 'desc',
        },

        include: {
          items: true,

          payment: {
            include: {
              attempts: true,
            },
          },
        },
      }),

      this.prisma.order.count({
        where,
      }),
    ]);

    return {
      data: orders,

      meta: {
        page,

        limit,

        total,

        totalPages: Math.ceil(total / limit),

        hasNextPage: page * limit < total,

        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(
    userId: string,

    orderId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,

        userId,
      },

      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,

                name: true,

                sku: true,

                imageUrl: true,
              },
            },
          },
        },

        payment: {
          include: {
            attempts: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async cancel(
    userId: string,

    orderId: string,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,

        userId,
      },

      include: {
        items: true,

        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,

      OrderStatus.PAYMENT_PENDING,
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new ConflictException('Order cannot be cancelled at this stage');
    }

    await this.prisma.$transaction(async (tx) => {
      /**
       * Atomic status transition.
       *
       * This prevents two concurrent cancel
       * requests from both releasing stock.
       */
      const updated = await tx.order.updateMany({
        where: {
          id: order.id,

          userId,

          status: {
            in: [OrderStatus.PENDING, OrderStatus.PAYMENT_PENDING],
          },
        },

        data: {
          status: OrderStatus.CANCELLED,
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          'Order was already cancelled or payment has progressed',
        );
      }

      /**
       * Release inventory exactly once.
       */
      for (const item of order.items) {
        await this.inventoryService.releaseWithinTransaction(
          tx,

          item.productId,

          item.quantity,
        );
      }

      /**
       * Payment can remain PENDING/FAILED
       * depending on the exact payment flow.
       *
       * We don't mark it SUCCESS/REFUND here.
       */
    });

    return {
      message: 'Order cancelled successfully',

      orderId,
    };
  }

  private generateOrderNumber() {
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    return `ORD-${date}-${random}`;
  }
}
