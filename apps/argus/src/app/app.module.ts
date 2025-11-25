import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule, LoggerModule, HttpLoggerMiddleware } from '@opareta/common';
import { DatabaseModule, databaseConfig } from './database';
import { AuthModule } from './auth';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['apps/argus/.env'],
      isGlobal: true,
      load: [databaseConfig],
    }),
    LoggerModule.forRoot({
      appName: 'Argus',
      logLevel: process.env.LOG_LEVEL || 'info',
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(HttpLoggerMiddleware).forRoutes('*');
  }
}
