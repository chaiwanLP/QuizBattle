import { Logger, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const origins = config
    .getOrThrow<string>('CORS_ORIGINS')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({ origin: origins, credentials: true });

  // Validates parameters that declare a Standard Schema (`@Body({ schema })`).
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  // Lets Prisma/Redis close their connections on SIGINT/SIGTERM.
  app.enableShutdownHooks();

  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
