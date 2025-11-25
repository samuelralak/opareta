import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter, createBootstrapLogger } from '@opareta/common';

async function bootstrap() {
  const bootstrapLogger = createBootstrapLogger({ appName: 'Argus' });

  const app = await NestFactory.create(AppModule, {
    logger: bootstrapLogger,
  });

  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  const config = app.get(ConfigService);

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Argus Authentication API')
    .setDescription('Authentication service for user registration, login, and token verification')
    .setVersion('1.0')
    .addTag('auth')
    .addBearerAuth()
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, documentFactory);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`Application running on: http://localhost:${port}/api`);
  logger.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
