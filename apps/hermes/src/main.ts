import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const port = config.get<number>('PORT', 3001);
  app.setGlobalPrefix('api');

  await app.listen(port);
  Logger.log(`🚀 Application running on: http://localhost:${port}/api`);
}

bootstrap();
