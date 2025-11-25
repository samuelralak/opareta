import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { PaymentWebhookService } from './payment-webhook.service';
import { PaymentsService } from '../payments/payments.service';
import { Payment, PaymentStatus, PaymentCurrency, PaymentMethod } from '../payments/entities';
import { WebhookEvent } from './entities';

describe('PaymentWebhookService', () => {
  let service: PaymentWebhookService;
  let paymentRepository: jest.Mocked<Repository<Payment>>;
  let webhookEventRepository: jest.Mocked<Repository<WebhookEvent>>;
  let paymentsService: jest.Mocked<PaymentsService>;

  const mockPayment: Payment = {
    id: 'payment-uuid-123',
    reference: 'PAY-ABC12345',
    user_id: 'user-uuid-123',
    amount: 1000,
    currency: PaymentCurrency.UGX,
    payment_method: PaymentMethod.MOBILE_MONEY,
    customer_phone: '+256700000000',
    customer_email: 'test@example.com',
    status: PaymentStatus.PENDING,
    provider_reference: 'PRV-123',
    provider_transaction_id: null as unknown as string,
    failure_reason: null as unknown as string,
    created_at: new Date(),
    updated_at: new Date(),
    status_logs: [],
  };

  const webhookPayload = {
    webhook_id: 'WH-123',
    payment_reference: 'PAY-ABC12345',
    status: 'SUCCESS' as const,
    provider_transaction_id: 'TXN-456',
    timestamp: '2025-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentWebhookService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WebhookEvent),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            transitionStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentWebhookService>(PaymentWebhookService);
    paymentRepository = module.get(getRepositoryToken(Payment));
    webhookEventRepository = module.get(getRepositoryToken(WebhookEvent));
    paymentsService = module.get(PaymentsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processWebhook', () => {
    it('should process a new webhook successfully', async () => {
      const webhookEvent = {
        id: 'webhook-event-uuid-123',
        webhook_id: 'WH-123',
        payment_reference: 'PAY-ABC12345',
        payload: webhookPayload,
        processed: false,
        received_at: new Date(),
      };

      webhookEventRepository.findOne.mockResolvedValue(null);
      webhookEventRepository.create.mockReturnValue(webhookEvent as WebhookEvent);
      webhookEventRepository.save.mockResolvedValue(webhookEvent as WebhookEvent);
      paymentRepository.findOne.mockResolvedValue(mockPayment);
      paymentRepository.save.mockResolvedValue(mockPayment);
      paymentsService.transitionStatus.mockResolvedValue();

      await service.processWebhook(webhookPayload);

      expect(webhookEventRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhook_id: 'WH-123',
          payment_reference: 'PAY-ABC12345',
        })
      );
      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          provider_transaction_id: 'TXN-456',
        })
      );
      expect(paymentsService.transitionStatus).toHaveBeenCalledWith(
        mockPayment,
        PaymentStatus.SUCCESS,
        'WEBHOOK',
        'Provider webhook: SUCCESS'
      );
    });

    it('should silently return for already processed webhooks', async () => {
      const processedEvent = {
        webhook_id: 'WH-123',
        processed: true,
      };

      webhookEventRepository.findOne.mockResolvedValue(processedEvent as WebhookEvent);

      await service.processWebhook(webhookPayload);

      expect(webhookEventRepository.create).not.toHaveBeenCalled();
      expect(paymentRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when payment is not found', async () => {
      const webhookEvent = {
        id: 'webhook-event-uuid-123',
        webhook_id: 'WH-123',
        payment_reference: 'PAY-NOTFOUND',
        payload: webhookPayload,
        processed: false,
        received_at: new Date(),
      };

      webhookEventRepository.findOne.mockResolvedValue(null);
      webhookEventRepository.create.mockReturnValue(webhookEvent as WebhookEvent);
      webhookEventRepository.save.mockResolvedValue(webhookEvent as WebhookEvent);
      paymentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.processWebhook({ ...webhookPayload, payment_reference: 'PAY-NOTFOUND' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should set failure_reason when webhook status is FAILED', async () => {
      const pendingPayment = { ...mockPayment, status: PaymentStatus.PENDING };
      const webhookEvent = {
        id: 'webhook-event-uuid-123',
        webhook_id: 'WH-123',
        payment_reference: 'PAY-ABC12345',
        payload: { ...webhookPayload, status: 'FAILED' },
        processed: false,
        received_at: new Date(),
      };

      webhookEventRepository.findOne.mockResolvedValue(null);
      webhookEventRepository.create.mockReturnValue(webhookEvent as WebhookEvent);
      webhookEventRepository.save.mockResolvedValue(webhookEvent as WebhookEvent);
      paymentRepository.findOne.mockResolvedValue(pendingPayment);
      paymentRepository.save.mockResolvedValue(pendingPayment);
      paymentsService.transitionStatus.mockResolvedValue();

      await service.processWebhook({ ...webhookPayload, status: 'FAILED' });

      expect(paymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failure_reason: 'Payment failed at provider',
        })
      );
      expect(paymentsService.transitionStatus).toHaveBeenCalledWith(
        pendingPayment,
        PaymentStatus.FAILED,
        'WEBHOOK',
        'Provider webhook: FAILED'
      );
    });

    it('should mark webhook as not processed on error', async () => {
      const webhookEvent = {
        id: 'webhook-event-uuid-123',
        webhook_id: 'WH-123',
        payment_reference: 'PAY-ABC12345',
        payload: webhookPayload,
        processed: false,
        received_at: new Date(),
      };

      webhookEventRepository.findOne.mockResolvedValue(null);
      webhookEventRepository.create.mockReturnValue(webhookEvent as WebhookEvent);
      webhookEventRepository.save.mockResolvedValue(webhookEvent as WebhookEvent);
      paymentRepository.findOne.mockResolvedValue(null);

      await expect(service.processWebhook(webhookPayload)).rejects.toThrow(NotFoundException);

      expect(webhookEventRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          processed: false,
        })
      );
    });

    it('should mark webhook as processed on success', async () => {
      const webhookEvent = {
        id: 'webhook-event-uuid-123',
        webhook_id: 'WH-123',
        payment_reference: 'PAY-ABC12345',
        payload: webhookPayload,
        processed: false,
        received_at: new Date(),
      };

      webhookEventRepository.findOne.mockResolvedValue(null);
      webhookEventRepository.create.mockReturnValue(webhookEvent as WebhookEvent);
      webhookEventRepository.save.mockResolvedValue(webhookEvent as WebhookEvent);
      paymentRepository.findOne.mockResolvedValue(mockPayment);
      paymentRepository.save.mockResolvedValue(mockPayment);
      paymentsService.transitionStatus.mockResolvedValue();

      await service.processWebhook(webhookPayload);

      expect(webhookEventRepository.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          processed: true,
        })
      );
    });
  });
});
