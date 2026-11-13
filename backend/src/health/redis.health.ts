import { Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redis: RedisService,
  ) {}

  isHealthy(key = 'redis') {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        await this.redis.ping();
      })
      .withTimeout(2000);
  }
}
