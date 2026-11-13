import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(configService: ConfigService) {
    this.client = new Redis(configService.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    this.client.on('error', (error: Error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  /** The shared Redis client. Use it for hashes, sets, sorted sets, pub/sub. */
  get connection(): Redis {
    return this.client;
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Connected to Redis');
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      // Connection already gone; make sure the socket is closed.
      this.client.disconnect();
    }
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}
