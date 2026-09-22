import { Module } from '@nestjs/common';

import { AnalyticsController } from './analytics.controller';

import { AnalyticsService } from './analytics.service';

import { AnalyticsListener } from './analytics.listener';

@Module({
  controllers: [AnalyticsController],

  providers: [AnalyticsService, AnalyticsListener],

  exports: [AnalyticsService],
})
export class AnalyticsModule {}
