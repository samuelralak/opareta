import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from '@opareta/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatusLog, WebhookEvent } from './entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentStatusLog, WebhookEvent]),
    CommonModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
