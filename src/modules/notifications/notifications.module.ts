import { Module } from '@nestjs/common';

import { JwtModule } from '@nestjs/jwt';

import { NotificationsController } from './notifications.controller';

import { NotificationsGateway } from './notifications.gateway';

import { NotificationsListener } from './notifications.listener';

import { NotificationsService } from './notifications.service';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],

  controllers: [NotificationsController],

  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationsListener,
  ],

  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
