import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus, WebhookEvent } from '../payments/entities';
import { type WebhookPayloadInput } from '../payments/dto';
import { PaymentsService } from '../payments/payments.service';

const WEBHOOK_STATUS_MAP: Record<string, PaymentStatus> = {
  SUCCESS: PaymentStatus.SUCCESS,
  FAILED: PaymentStatus.FAILED,
};

@Injectable()
export class PaymentWebhookService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    private readonly paymentsService: PaymentsService
  ) {}

  async processWebhook(payload: WebhookPayloadInput): Promise<void> {
    if (await this.isAlreadyProcessed(payload.webhook_id)) {
      return;
    }

    const webhookEvent = await this.createWebhookEvent(payload);

    try {
      const payment = await this.findPaymentByReference(payload.payment_reference);
      const newStatus = WEBHOOK_STATUS_MAP[payload.status] ?? PaymentStatus.FAILED;

      await this.updatePaymentFromWebhook(payment, payload, newStatus);
      await this.paymentsService.transitionStatus(
        payment,
        newStatus,
        'WEBHOOK',
        `Provider webhook: ${payload.status}`
      );

      await this.markWebhookProcessed(webhookEvent, true);
    } catch (error) {
      await this.markWebhookProcessed(webhookEvent, false);
      throw error;
    }
  }

  private async isAlreadyProcessed(webhookId: string): Promise<boolean> {
    const existingEvent = await this.webhookEventRepository.findOne({
      where: { webhook_id: webhookId },
    });

    return existingEvent?.processed === true;
  }

  private async createWebhookEvent(payload: WebhookPayloadInput): Promise<WebhookEvent> {
    const webhookEvent = this.webhookEventRepository.create({
      webhook_id: payload.webhook_id,
      payment_reference: payload.payment_reference,
      payload: payload as unknown as Record<string, unknown>,
      processed: false,
    });
    return this.webhookEventRepository.save(webhookEvent);
  }

  private async findPaymentByReference(reference: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { reference },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with reference ${reference} not found`);
    }

    return payment;
  }

  private async updatePaymentFromWebhook(
    payment: Payment,
    payload: WebhookPayloadInput,
    newStatus: PaymentStatus
  ): Promise<void> {
    payment.provider_transaction_id = payload.provider_transaction_id;

    if (newStatus === PaymentStatus.FAILED) {
      payment.failure_reason = 'Payment failed at provider';
    }

    await this.paymentRepository.save(payment);
  }

  private async markWebhookProcessed(webhookEvent: WebhookEvent, processed: boolean): Promise<void> {
    webhookEvent.processed = processed;
    await this.webhookEventRepository.save(webhookEvent);
  }
}
