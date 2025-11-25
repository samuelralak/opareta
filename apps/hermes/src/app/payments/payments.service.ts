import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { DummyProvider } from '@opareta/dummy-provider';
import { ConfigService } from '@nestjs/config';
import {
  Payment,
  PaymentStatus,
  PaymentStatusLog,
  WebhookEvent,
  type StatusTrigger,
} from './entities';
import {
  type CreatePaymentInput,
  type UpdatePaymentStatusInput,
  type WebhookPayloadInput,
} from './dto';

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.INITIATED]: [PaymentStatus.PENDING, PaymentStatus.FAILED],
  [PaymentStatus.PENDING]: [PaymentStatus.SUCCESS, PaymentStatus.FAILED],
  [PaymentStatus.SUCCESS]: [],
  [PaymentStatus.FAILED]: [],
};

@Injectable()
export class PaymentsService {
  private readonly dummyProvider: DummyProvider;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(PaymentStatusLog)
    private readonly statusLogRepository: Repository<PaymentStatusLog>,
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService
  ) {
    const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3001');
    this.dummyProvider = new DummyProvider({
      callbackUrl: `${baseUrl}/payments/webhook`,
      successRate: 0.8,
      minDelayMs: 2000,
      maxDelayMs: 5000,
    });
  }

  async createPayment(
    userId: string,
    input: CreatePaymentInput
  ): Promise<Payment> {
    const reference = `PAY-${randomUUID().slice(0, 8).toUpperCase()}`;

    const payment = this.paymentRepository.create({
      reference,
      user_id: userId,
      amount: input.amount,
      currency: input.currency,
      payment_method: input.payment_method,
      customer_phone: input.customer_phone,
      customer_email: input.customer_email,
      status: PaymentStatus.INITIATED,
    });

    await this.paymentRepository.save(payment);

    const providerResponse = await this.dummyProvider.initiatePayment({
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      phone_number: payment.customer_phone,
      callback_url: `${this.configService.get<string>('BASE_URL', 'http://localhost:3001')}/payments/webhook`,
    });

    if (providerResponse.success) {
      await this.transitionStatus(
        payment,
        PaymentStatus.PENDING,
        'SYSTEM',
        'Payment sent to provider'
      );
      payment.provider_reference = providerResponse.provider_reference;
      await this.paymentRepository.save(payment);
    }

    return this.paymentRepository.findOneOrFail({
      where: { id: payment.id },
      relations: ['status_logs'],
    });
  }

  async getPaymentByReference(reference: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { reference },
      relations: ['status_logs'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment with reference ${reference} not found`);
    }

    return payment;
  }

  async updatePaymentStatus(
    reference: string,
    input: UpdatePaymentStatusInput
  ): Promise<Payment> {
    const payment = await this.getPaymentByReference(reference);
    await this.transitionStatus(payment, input.status, 'ADMIN', input.reason);
    return this.paymentRepository.findOneOrFail({
      where: { id: payment.id },
      relations: ['status_logs'],
    });
  }

  async processWebhook(payload: WebhookPayloadInput): Promise<void> {
    const existingEvent = await this.webhookEventRepository.findOne({
      where: { webhook_id: payload.webhook_id },
    });

    if (existingEvent) {
      if (existingEvent.processed) {
        return;
      }
      throw new ConflictException('Webhook is currently being processed');
    }

    const webhookEvent = this.webhookEventRepository.create({
      webhook_id: payload.webhook_id,
      payment_reference: payload.payment_reference,
      payload: payload as unknown as Record<string, unknown>,
      processed: false,
    });

    await this.webhookEventRepository.save(webhookEvent);

    try {
      const payment = await this.paymentRepository.findOne({
        where: { reference: payload.payment_reference },
      });

      if (!payment) {
        throw new NotFoundException(
          `Payment with reference ${payload.payment_reference} not found`
        );
      }

      payment.provider_transaction_id = payload.provider_transaction_id;

      const newStatus =
        payload.status === 'SUCCESS'
          ? PaymentStatus.SUCCESS
          : PaymentStatus.FAILED;

      if (newStatus === PaymentStatus.FAILED) {
        payment.failure_reason = 'Payment failed at provider';
      }

      await this.paymentRepository.save(payment);
      await this.transitionStatus(
        payment,
        newStatus,
        'WEBHOOK',
        `Provider webhook: ${payload.status}`
      );

      webhookEvent.processed = true;
      await this.webhookEventRepository.save(webhookEvent);
    } catch (error) {
      webhookEvent.processed = false;
      await this.webhookEventRepository.save(webhookEvent);
      throw error;
    }
  }

  private async transitionStatus(
    payment: Payment,
    newStatus: PaymentStatus,
    triggeredBy: StatusTrigger,
    reason?: string
  ): Promise<void> {
    const validNextStatuses = VALID_TRANSITIONS[payment.status];

    if (!validNextStatuses.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${payment.status} to ${newStatus}`
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const statusLog = queryRunner.manager.create(PaymentStatusLog, {
        payment_id: payment.id,
        from_status: payment.status,
        to_status: newStatus,
        reason: reason,
        triggered_by: triggeredBy,
      });

      await queryRunner.manager.save(PaymentStatusLog, statusLog);

      await queryRunner.manager.update(Payment, payment.id, {
        status: newStatus,
      });
      payment.status = newStatus;

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
