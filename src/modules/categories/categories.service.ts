import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoriesQueryDto } from './dto/categories-query.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const name = dto.name.trim();
    const slug = dto.slug.trim().toLowerCase();

    const existing = await this.prisma.category.findFirst({
      where: {
        OR: [{ name }, { slug }],
      },
    });

    if (existing) {
      if (existing.slug === slug) {
        throw new ConflictException('Category slug already exists');
      }

      throw new ConflictException('Category name already exists');
    }

    try {
      return await this.prisma.category.create({
        data: {
          name,
          slug,
          description: dto.description?.trim() || null,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Category name or slug already exists');
      }

      throw error;
    }
  }

  async findAll(query: CategoriesQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {};

    /*
     * Default behavior:
     *
     * GET /categories
     *
     * only returns active categories.
     *
     * Admin can explicitly request inactive
     * categories using ?isActive=false
     */
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    } else {
      where.isActive = true;
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
          slug: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),

      this.prisma.category.count({
        where,
      }),
    ]);

    return {
      data: categories,

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
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const name = dto.name?.trim();
    const slug = dto.slug?.trim().toLowerCase();

    if (name || slug) {
      const duplicate = await this.prisma.category.findFirst({
        where: {
          id: {
            not: id,
          },
          OR: [...(name ? [{ name }] : []), ...(slug ? [{ slug }] : [])],
        },
      });

      if (duplicate) {
        throw new ConflictException(
          'Another category already uses this name or slug',
        );
      }
    }

    try {
      return await this.prisma.category.update({
        where: {
          id,
        },

        data: {
          ...(name !== undefined && {
            name,
          }),

          ...(slug !== undefined && {
            slug,
          }),

          ...(dto.description !== undefined && {
            description: dto.description?.trim() || null,
          }),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Category name or slug already exists');
      }

      throw error;
    }
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: {
        id,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const activeProducts = await this.prisma.product.count({
      where: {
        categoryId: id,
        isActive: true,
      },
    });

    if (activeProducts > 0) {
      throw new BadRequestException(
        `Cannot deactivate category. ${activeProducts} active product(s) still belong to this category.`,
      );
    }

    return this.prisma.category.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }
}
