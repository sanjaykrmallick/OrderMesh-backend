import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';

import type { Request } from 'express';

import { NotificationsService } from './notifications.service';

import { NotificationQueryDto } from './dto/notification-query.dto';

type AuthenticatedRequest = Request & {
  user: {
    userId: string;
  };
};

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * GET /notifications
   */
  @Get()
  async getMyNotifications(
    @Req() req: Request,
    @Query()
    query: NotificationQueryDto,
  ) {
    const userId = (req as AuthenticatedRequest).user.userId;

    return this.notificationsService.findMyNotifications(userId, query);
  }

  /**
   * GET /notifications/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: Request) {
    const userId = (req as AuthenticatedRequest).user.userId;

    return this.notificationsService.getUnreadCount(userId);
  }

  /**
   * PATCH /notifications/:id/read
   */
  @Patch(':id/read')
  async markAsRead(
    @Req() req: Request,

    @Param('id')
    notificationId: string,
  ) {
    const userId = (req as AuthenticatedRequest).user.userId;

    return this.notificationsService.markAsRead(userId, notificationId);
  }

  /**
   * PATCH /notifications/read-all
   */
  @Patch('read-all')
  async markAllAsRead(@Req() req: Request) {
    const userId = (req as AuthenticatedRequest).user.userId;

    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * DELETE /notifications/:id
   */
  @Delete(':id')
  async delete(
    @Req() req: Request,

    @Param('id')
    notificationId: string,
  ) {
    const userId = (req as AuthenticatedRequest).user.userId;

    return this.notificationsService.delete(userId, notificationId);
  }
}
