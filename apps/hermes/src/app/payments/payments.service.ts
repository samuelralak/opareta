import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { DummyProvider } from '@opareta/dummy-provider';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, PaymentStatusLog, type StatusTrigger } from './entities';
import { type CreatePaymentInput, type UpdatePaymentStatusInput } from './dto';

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PaymentStatus.INITIATED]: [PaymentStatus.PENDING, PaymentStatus.FAILED],
  [PaymentStatus.PENDING]: [PaymentStatus.SUCCESS, PaymentStatus.FAILED],
  [PaymentStatus.SUCCESS]: [],
  [PaymentStatus.FAILED]: [],
};

@Injectable()
export class PaymentsService {
  private readonly dummyProvider: DummyProvider;
  private readonly webhookUrl: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService
  ) {
    const baseUrl = this.configService.get<string>('BASE_URL', 'http://localhost:3001');
    this.webhookUrl = `${baseUrl}/webhooks/payments`;
    this.dummyProvider = new DummyProvider({
      callbackUrl: this.webhookUrl,
      successRate: 0.8,
      minDelayMs: 2000,
      maxDelayMs: 5000,
    });
  }

  async createPayment(userId: string, input: CreatePaymentInput): Promise<Payment> {
    const payment = this.paymentRepository.create({
      reference: this.generateReference(),
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
      callback_url: this.webhookUrl,
    });

    if (providerResponse.success) {
      await this.transitionStatus(payment, PaymentStatus.PENDING, 'SYSTEM', 'Payment sent to provider');
      payment.provider_reference = providerResponse.provider_reference;
      await this.paymentRepository.save(payment);
    }

    return this.findPaymentWithLogs(payment.id);
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

  async updatePaymentStatus(reference: string, input: UpdatePaymentStatusInput): Promise<Payment> {
    const payment = await this.getPaymentByReference(reference);
    await this.transitionStatus(payment, input.status, 'ADMIN', input.reason);
    return this.findPaymentWithLogs(payment.id);
  }

  async transitionStatus(
    payment: Payment,
    newStatus: PaymentStatus,
    triggeredBy: StatusTrigger,
    reason?: string
  ): Promise<void> {
    const validNextStatuses = VALID_TRANSITIONS[payment.status];

    if (!validNextStatuses.includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${payment.status} to ${newStatus}`);
    }

    await this.dataSource.transaction(async (manager: EntityManager) => {
      const statusLog = manager.create(PaymentStatusLog, {
        payment_id: payment.id,
        from_status: payment.status,
        to_status: newStatus,
        reason,
        triggered_by: triggeredBy,
      });

      await manager.save(PaymentStatusLog, statusLog);
      await manager.update(Payment, payment.id, { status: newStatus });
      payment.status = newStatus;
    });
  }

  private generateReference(): string {
    return `PAY-${randomUUID().slice(0, 8).toUpperCase()}`;
  }

  private findPaymentWithLogs(id: string): Promise<Payment> {
    return this.paymentRepository.findOneOrFail({
      where: { id },
      relations: ['status_logs'],
    });
  }
}
