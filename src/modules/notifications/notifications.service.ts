import { Injectable, NotFoundException } from '@nestjs/common';

import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create an in-app notification.
   */
  async create(params: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.UNREAD,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /**
   * Get current user's notifications.
   */
  async findMyNotifications(
    userId: string,
    query: {
      page?: number;
      limit?: number;
      status?: NotificationStatus;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const skip = (page - 1) * limit;

    const where = {
      userId,
      ...(query.status
        ? {
            status: query.status,
          }
        : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,

        orderBy: {
          createdAt: 'desc',
        },

        skip,
        take: limit,
      }),

      this.prisma.notification.count({
        where,
      }),

      this.prisma.notification.count({
        where: {
          userId,
          status: NotificationStatus.UNREAD,
        },
      }),
    ]);

    return {
      data: notifications,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },

      unreadCount,
    };
  }

  /**
   * Mark one notification as read.
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.status === NotificationStatus.READ) {
      return notification;
    }

    return this.prisma.notification.update({
      where: {
        id: notificationId,
      },

      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read.
   */
  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        status: NotificationStatus.UNREAD,
      },

      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });

    return {
      updatedCount: result.count,
    };
  }

  /**
   * Delete a notification.
   */
  async delete(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId,
      },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.delete({
      where: {
        id: notificationId,
      },
    });

    return {
      message: 'Notification deleted successfully',
    };
  }

  /**
   * Get unread notification count.
   */
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        status: NotificationStatus.UNREAD,
      },
    });

    return {
      unreadCount: count,
    };
  }
}
