import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
      },

      include: {
        items: {
          orderBy: {
            createdAt: 'asc',
          },

          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                slug: true,
                priceInCents: true,
                imageUrl: true,
                isActive: true,

                inventory: {
                  select: {
                    availableQuantity: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart) {
      return {
        id: null,
        items: [],
        totalItems: 0,
        totalAmountInCents: 0,
      };
    }

    const totalItems = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    const totalAmountInCents = cart.items.reduce(
      (sum, item) => sum + item.quantity * item.product.priceInCents,
      0,
    );

    return {
      id: cart.id,
      items: cart.items,
      totalItems,
      totalAmountInCents,
    };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: {
        id: dto.productId,
      },

      include: {
        inventory: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (!product.isActive) {
      throw new ConflictException('Product is inactive');
    }

    if (!product.inventory) {
      throw new ConflictException('Product inventory is not available');
    }

    if (product.inventory.availableQuantity < dto.quantity) {
      throw new ConflictException('Requested quantity is not available');
    }

    /*
     * Find or create user's cart.
     */
    let cart = await this.prisma.cart.findFirst({
      where: {
        userId,
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId,
        },
      });
    }

    /*
     * If product already exists,
     * increase quantity.
     */
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: dto.productId,
        },
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + dto.quantity;

      if (product.inventory.availableQuantity < newQuantity) {
        throw new ConflictException(
          `Only ${product.inventory.availableQuantity} units are currently available`,
        );
      }

      await this.prisma.cartItem.update({
        where: {
          id: existingItem.id,
        },

        data: {
          quantity: newQuantity,
        },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          quantity: dto.quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  async updateItem(userId: string, productId: string, dto: UpdateCartItemDto) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const item = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },

      include: {
        product: {
          include: {
            inventory: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (!item.product.isActive) {
      throw new ConflictException('Product is inactive');
    }

    if (
      !item.product.inventory ||
      item.product.inventory.availableQuantity < dto.quantity
    ) {
      throw new ConflictException('Requested quantity is not available');
    }

    await this.prisma.cartItem.update({
      where: {
        id: item.id,
      },

      data: {
        quantity: dto.quantity,
      },
    });

    return this.getCart(userId);
  }

  async removeItem(userId: string, productId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
      },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const item = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({
      where: {
        id: item.id,
      },
    });

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findFirst({
      where: {
        userId,
      },
    });

    if (!cart) {
      return {
        message: 'Cart already empty',
      };
    }

    await this.prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
      },
    });

    return {
      message: 'Cart cleared successfully',
    };
  }
}
