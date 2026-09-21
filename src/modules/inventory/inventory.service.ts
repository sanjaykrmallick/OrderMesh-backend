import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { ReserveInventoryDto } from './dto/reserve-inventory.dto';
import { ReleaseInventoryDto } from './dto/release-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private getStatus(availableQuantity: number) {
    if (availableQuantity <= 0) {
      return 'OUT_OF_STOCK' as const;
    }

    return 'AVAILABLE' as const;
  }

  async findAll() {
    return this.prisma.inventory.findMany({
      orderBy: {
        updatedAt: 'desc',
      },

      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            priceInCents: true,
            isActive: true,

            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async findByProductId(productId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: {
        productId,
      },

      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            priceInCents: true,
            isActive: true,

            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    return inventory;
  }

  async adjust(productId: string, dto: AdjustInventoryDto) {
    if (dto.quantity === 0) {
      throw new BadRequestException('Quantity cannot be zero');
    }

    /*
     * Make sure product exists.
     */
    const product = await this.prisma.product.findUnique({
      where: {
        id: productId,
      },

      select: {
        id: true,
        isActive: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isActive) {
      throw new ConflictException(
        'Cannot modify inventory of an inactive product',
      );
    }

    /*
     * Make sure inventory exists.
     */
    const inventory = await this.prisma.inventory.findUnique({
      where: {
        productId,
      },

      select: {
        productId: true,
      },
    });

    if (!inventory) {
      throw new NotFoundException('Inventory not found');
    }

    /*
     * Positive adjustment
     *
     * Example:
     *
     * available = 50
     * quantity  = +20
     *
     * available = 70
     */
    if (dto.quantity > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.inventory.update({
          where: {
            productId,
          },

          data: {
            availableQuantity: {
              increment: dto.quantity,
            },

            status: 'AVAILABLE',
          },
        });

        await tx.inventoryAdjustment.create({
          data: {
            productId,

            quantity: dto.quantity,

            type: dto.type,

            reason: dto.reason?.trim() || null,
          },
        });
      });

      return this.findByProductId(productId);
    }

    /*
     * Negative adjustment.
     *
     * Example:
     *
     * available = 10
     * adjustment = -4
     *
     * available = 6
     *
     * But never allow:
     *
     * available = -1
     */
    const quantityToRemove = Math.abs(dto.quantity);

    const result = await this.prisma.inventory.updateMany({
      where: {
        productId,

        availableQuantity: {
          gte: quantityToRemove,
        },
      },

      data: {
        availableQuantity: {
          decrement: quantityToRemove,
        },
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Insufficient available inventory');
    }

    await this.prisma.inventoryAdjustment.create({
      data: {
        productId,

        quantity: dto.quantity,

        type: dto.type,

        reason: dto.reason?.trim() || null,
      },
    });

    /*
     * Keep status synchronized.
     */
    const updated = await this.prisma.inventory.findUnique({
      where: {
        productId,
      },

      select: {
        availableQuantity: true,
      },
    });

    if (updated) {
      await this.prisma.inventory.update({
        where: {
          productId,
        },

        data: {
          status: this.getStatus(updated.availableQuantity),
        },
      });
    }

    return this.findByProductId(productId);
  }

  async reserve(productId: string, dto: ReserveInventoryDto) {
    /*
     * Product must exist and be active.
     */
    const product = await this.prisma.product.findUnique({
      where: {
        id: productId,
      },

      select: {
        id: true,
        isActive: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isActive) {
      throw new ConflictException('Product is inactive');
    }

    /*
     * CRITICAL:
     *
     * This is an atomic conditional update.
     *
     * If:
     *
     * availableQuantity >= requested quantity
     *
     * then:
     *
     * availableQuantity -= quantity
     * reservedQuantity += quantity
     *
     * Otherwise nothing is updated.
     */
    const result = await this.prisma.inventory.updateMany({
      where: {
        productId,

        availableQuantity: {
          gte: dto.quantity,
        },
      },

      data: {
        availableQuantity: {
          decrement: dto.quantity,
        },

        reservedQuantity: {
          increment: dto.quantity,
        },
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Insufficient inventory available');
    }

    /*
     * Keep status synchronized.
     */
    await this.syncStatus(productId);

    return this.findByProductId(productId);
  }

  async release(productId: string, dto: ReleaseInventoryDto) {
    /*
     * Only release inventory that is
     * actually reserved.
     */
    const result = await this.prisma.inventory.updateMany({
      where: {
        productId,

        reservedQuantity: {
          gte: dto.quantity,
        },
      },

      data: {
        reservedQuantity: {
          decrement: dto.quantity,
        },

        availableQuantity: {
          increment: dto.quantity,
        },
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Insufficient reserved inventory');
    }

    await this.syncStatus(productId);

    return this.findByProductId(productId);
  }

  private async syncStatus(productId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: {
        productId,
      },

      select: {
        availableQuantity: true,
      },
    });

    if (!inventory) {
      return;
    }

    await this.prisma.inventory.update({
      where: {
        productId,
      },

      data: {
        status: this.getStatus(inventory.availableQuantity),
      },
    });
  }

  async reserveWithinTransaction(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
  ) {
    const result = await tx.inventory.updateMany({
      where: {
        productId,

        availableQuantity: {
          gte: quantity,
        },
      },

      data: {
        availableQuantity: {
          decrement: quantity,
        },

        reservedQuantity: {
          increment: quantity,
        },
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Insufficient inventory');
    }
  }

  async releaseWithinTransaction(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
  ) {
    const result = await tx.inventory.updateMany({
      where: {
        productId,

        reservedQuantity: {
          gte: quantity,
        },
      },

      data: {
        reservedQuantity: {
          decrement: quantity,
        },

        availableQuantity: {
          increment: quantity,
        },
      },
    });

    if (result.count === 0) {
      throw new ConflictException('Insufficient reserved inventory');
    }
  }
}
