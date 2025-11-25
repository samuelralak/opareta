import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule, LoggerModule, HttpLoggerMiddleware } from '@opareta/common';
import { DatabaseModule, databaseConfig } from './database';
import { PaymentsModule } from './payments/payments.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['apps/hermes/.env'],
      isGlobal: true,
      load: [databaseConfig],
    }),
    LoggerModule.forRoot({
      appName: 'Hermes',
      logLevel: process.env.LOG_LEVEL || 'info',
    }),
    DatabaseModule,
    CommonModule,
    PaymentsModule,
    WebhooksModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
