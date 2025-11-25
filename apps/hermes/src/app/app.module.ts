import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '@opareta/common';
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
    DatabaseModule,
    CommonModule,
    PaymentsModule,
    WebhooksModule,
  ],
})
export class AppModule {}
