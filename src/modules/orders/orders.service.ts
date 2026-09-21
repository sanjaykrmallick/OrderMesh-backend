import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { OrderStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';
import { InventoryService } from '../inventory/inventory.service';

import { CheckoutDto } from './dto/checkout.dto';
import { OrdersQueryDto } from './dto/orders-query.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async checkout(userId: string, dto: CheckoutDto) {
    /*
     * Get user's cart.
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

    /*
     * Validate every cart item BEFORE
     * creating the order.
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

    /*
     * Calculate total using snapshot prices.
     */
    const totalAmountInCents = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.product.priceInCents,
      0,
    );

    if (totalAmountInCents <= 0) {
      throw new BadRequestException('Invalid order amount');
    }

    /*
     * Generate unique order number.
     */
    const orderNumber = this.generateOrderNumber();

    /*
     * IMPORTANT:
     *
     * We reserve inventory and create the
     * order in one MongoDB transaction.
     *
     * If any reservation fails, the entire
     * transaction rolls back.
     */
    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Reserve inventory
      for (const item of cart.items) {
        await this.inventoryService.reserveWithinTransaction(
          tx,
          item.productId,
          item.quantity,
        );
      }

      // 2. Create order
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,

          userId,

          totalAmountInCents,

          status: OrderStatus.PAYMENT_PENDING,

          shippingAddress: dto.shippingAddress,

          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,

              productName: item.product.name,

              sku: item.product.sku,

              quantity: item.quantity,

              unitPriceInCents: item.product.priceInCents,

              totalPriceInCents: item.quantity * item.product.priceInCents,
            })),
          },

          payment: {
            create: {
              amountInCents: totalAmountInCents,

              status: 'PENDING',
            },
          },
        },

        include: {
          items: true,
          payment: true,
        },
      });

      // 3. Clear cart
      await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      return createdOrder;
    });

    return order;
  }

  async findMyOrders(userId: string, query: OrdersQueryDto) {
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
          payment: true,
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

  async findOne(userId: string, orderId: string) {
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

        payment: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async cancel(userId: string, orderId: string) {
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

    /*
     * Only unpaid orders can be cancelled
     * through this endpoint.
     */
    const cancellableStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.PAYMENT_PENDING,
    ];

    if (!cancellableStatuses.includes(order.status)) {
      throw new ConflictException('Order cannot be cancelled at this stage');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await this.inventoryService.releaseWithinTransaction(
          tx,
          item.productId,
          item.quantity,
        );
      }

      await tx.order.update({
        where: {
          id: order.id,
        },

        data: {
          status: OrderStatus.CANCELLED,
        },
      });
    });

    return {
      message: 'Order cancelled successfully',
      orderId,
    };
  }

  private generateOrderNumber() {
    /*
     * Example:
     *
     * ORD-20260921-AB12CD
     */
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    return `ORD-${date}-${random}`;
  }
}
