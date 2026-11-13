import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  isHealthy(key = 'database') {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        await this.prisma.$queryRaw`SELECT 1`;
      })
      .withTimeout(2000);
  }
}
