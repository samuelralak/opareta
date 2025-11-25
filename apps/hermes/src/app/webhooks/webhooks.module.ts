import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhooksController } from './webhooks.controller';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentsModule } from '../payments/payments.module';
import { Payment, WebhookEvent } from '../payments/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, WebhookEvent]),
    PaymentsModule,
  ],
  controllers: [WebhooksController],
  providers: [PaymentWebhookService],
})
export class WebhooksModule {}
