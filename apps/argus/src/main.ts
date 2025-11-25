import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app/app.module';
import { HttpExceptionFilter } from '@opareta/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
  Logger.log(`Application running on: http://localhost:${port}/api`);
  Logger.log(`Swagger docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
