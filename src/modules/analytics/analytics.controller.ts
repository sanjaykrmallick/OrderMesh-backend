import { Controller, Get, Query } from '@nestjs/common';

import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { UserRole } from '@prisma/client';

import { Roles } from '../auth/decorators/roles.decorator';

import { AnalyticsService } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS)
  async dashboard(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = from
      ? new Date(from)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const toDate = to ? new Date(to) : new Date();

    return this.analyticsService.getDashboard(fromDate, toDate);
  }

  @Get('sales/products')
  @Roles(UserRole.ADMIN, UserRole.OPERATIONS)
  async salesByProduct(@Query('from') from: string, @Query('to') to: string) {
    const fromDate = from
      ? new Date(from)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const toDate = to ? new Date(to) : new Date();

    return this.analyticsService.getSalesByProduct(fromDate, toDate);
  }
}
