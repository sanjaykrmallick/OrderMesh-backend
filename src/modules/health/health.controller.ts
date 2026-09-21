import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';

import { PrismaService } from '../../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async (): Promise<HealthIndicatorResult> => {
        try {
          await this.prisma.$runCommandRaw({
            ping: 1,
          });

          return {
            mongodb: {
              status: 'up',
            },
          };
        } catch (error) {
          return {
            mongodb: {
              status: 'down',
            },
          };
        }
      },
    ]);
  }
}
