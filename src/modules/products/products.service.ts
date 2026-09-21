import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsQueryDto } from './dto/products-query.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const sku = dto.sku.trim().toUpperCase();

    const name = dto.name.trim();

    const slug = dto.slug.trim().toLowerCase();

    /*
     * Category must exist and be active.
     */
    const category = await this.prisma.category.findUnique({
      where: {
        id: dto.categoryId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (!category.isActive) {
      throw new ConflictException(
        'Cannot create product under an inactive category',
      );
    }

    /*
     * Check SKU and slug.
     */
    const existing = await this.prisma.product.findFirst({
      where: {
        OR: [{ sku }, { slug }],
      },
      select: {
        id: true,
        sku: true,
        slug: true,
      },
    });

    if (existing) {
      throw new ConflictException('Product SKU or slug already exists');
    }

    try {
      /*
       * Product + Inventory are created
       * atomically.
       */
      const product = await this.prisma.$transaction(async (tx) => {
        const createdProduct = await tx.product.create({
          data: {
            sku,
            name,
            slug,

            description: dto.description?.trim() || null,

            priceInCents: dto.priceInCents,

            imageUrl: dto.imageUrl?.trim() || null,

            categoryId: dto.categoryId,

            isActive: true,
          },
        });

        await tx.inventory.create({
          data: {
            productId: createdProduct.id,

            availableQuantity: 0,

            reservedQuantity: 0,

            status: 'OUT_OF_STOCK',
          },
        });

        return createdProduct;
      });

      return this.findOne(product.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Product SKU or slug already exists');
      }

      throw error;
    }
  }

  async findAll(query: ProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    /*
     * By default customers only see
     * active products.
     */
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    } else {
      where.isActive = true;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.search?.trim()) {
      const search = query.search.trim();

      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          sku: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          slug: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,

        orderBy: {
          createdAt: 'desc',
        },

        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },

          inventory: {
            select: {
              availableQuantity: true,
              reservedQuantity: true,
              status: true,
            },
          },
        },
      }),

      this.prisma.product.count({
        where,
      }),
    ]);

    return {
      data: products,

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

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: {
        id,
      },

      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },

        inventory: {
          select: {
            id: true,
            availableQuantity: true,
            reservedQuantity: true,
            status: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: {
        id,
      },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const sku = dto.sku?.trim().toUpperCase();

    const name = dto.name?.trim();

    const slug = dto.slug?.trim().toLowerCase();

    /*
     * Validate category if changed.
     */
    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: {
          id: dto.categoryId,
        },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      if (!category.isActive) {
        throw new ConflictException(
          'Cannot assign product to an inactive category',
        );
      }
    }

    /*
     * Check SKU/slug uniqueness.
     */
    const duplicateConditions: Array<{ sku?: string; slug?: string }> = [];

    if (sku) {
      duplicateConditions.push({
        sku,
      });
    }

    if (slug) {
      duplicateConditions.push({
        slug,
      });
    }

    if (duplicateConditions.length > 0) {
      const duplicate = await this.prisma.product.findFirst({
        where: {
          id: {
            not: id,
          },

          OR: duplicateConditions,
        },
      });

      if (duplicate) {
        throw new ConflictException(
          'Another product already uses this SKU or slug',
        );
      }
    }

    try {
      await this.prisma.product.update({
        where: {
          id,
        },

        data: {
          ...(sku !== undefined && {
            sku,
          }),

          ...(name !== undefined && {
            name,
          }),

          ...(slug !== undefined && {
            slug,
          }),

          ...(dto.description !== undefined && {
            description: dto.description?.trim() || null,
          }),

          ...(dto.priceInCents !== undefined && {
            priceInCents: dto.priceInCents,
          }),

          ...(dto.imageUrl !== undefined && {
            imageUrl: dto.imageUrl?.trim() || null,
          }),

          ...(dto.categoryId !== undefined && {
            categoryId: dto.categoryId,
          }),
        },
      });

      return this.findOne(id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Product SKU or slug already exists');
      }

      throw error;
    }
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: {
        id,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    /*
     * Soft delete.
     *
     * We don't physically delete because
     * OrderItem references this product.
     */
    await this.prisma.product.update({
      where: {
        id,
      },

      data: {
        isActive: false,
      },
    });

    return {
      message: 'Product deactivated successfully',
      productId: id,
    };
  }
}
