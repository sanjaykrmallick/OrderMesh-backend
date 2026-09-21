import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersQueryDto } from './dto/users-query.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get current authenticated user
   */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: this.userSelect(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Update current user's profile
   */
  async updateMe(userId: string, updateProfileDto: UpdateProfileDto) {
    const { firstName, lastName, phone } = updateProfileDto;

    if (phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: {
          phone,
          NOT: {
            id: userId,
          },
        },
      });

      if (existingPhone) {
        throw new ConflictException('Phone number already registered');
      }
    }

    const user = await this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        ...(firstName !== undefined && {
          firstName,
        }),

        ...(lastName !== undefined && {
          lastName,
        }),

        ...(phone !== undefined && {
          phone,
        }),
      },

      select: this.userSelect(),
    });

    return user;
  }

  /**
   * Get all users
   */
  async findAll(query: UsersQueryDto) {
    const { page = 1, limit = 20, search, role, isActive } = query;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        {
          firstName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phone: {
            contains: search,
          },
        },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,

        skip,
        take: limit,

        orderBy: {
          createdAt: 'desc',
        },

        select: this.userSelect(),
      }),

      this.prisma.user.count({
        where,
      }),
    ]);

    return {
      data: users,

      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get user by ID
   */
  async findById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: this.userSelect(),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Admin update user
   */
  async updateUser(userId: string, updateUserDto: UpdateUserDto) {
    await this.ensureUserExists(userId);

    const { firstName, lastName, phone, role, isActive } = updateUserDto;

    if (phone) {
      const existingPhone = await this.prisma.user.findFirst({
        where: {
          phone,
          NOT: {
            id: userId,
          },
        },
      });

      if (existingPhone) {
        throw new ConflictException('Phone number already registered');
      }
    }

    return this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        ...(firstName !== undefined && {
          firstName,
        }),

        ...(lastName !== undefined && {
          lastName,
        }),

        ...(phone !== undefined && {
          phone,
        }),

        ...(role !== undefined && {
          role,
        }),

        ...(isActive !== undefined && {
          isActive,
        }),
      },

      select: this.userSelect(),
    });
  }

  /**
   * Deactivate user
   */
  async deactivateUser(userId: string) {
    await this.ensureUserExists(userId);

    return this.prisma.user.update({
      where: {
        id: userId,
      },

      data: {
        isActive: false,
      },

      select: this.userSelect(),
    });
  }

  /**
   * Check user exists
   */
  private async ensureUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },

      select: {
        id: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Common user projection
   *
   * Never expose passwordHash.
   */
  private userSelect() {
    return {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
