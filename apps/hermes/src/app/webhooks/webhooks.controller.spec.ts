import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WebhooksController } from './webhooks.controller';
import { PaymentWebhookService } from './payment-webhook.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;
  let paymentWebhookService: jest.Mocked<PaymentWebhookService>;

  const webhookPayload = {
    webhook_id: 'WH-123',
    payment_reference: 'PAY-ABC12345',
    status: 'SUCCESS' as const,
    provider_transaction_id: 'TXN-456',
    timestamp: '2025-01-01T00:00:00.000Z',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [
        {
          provide: PaymentWebhookService,
          useValue: {
            processWebhook: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
    paymentWebhookService = module.get(PaymentWebhookService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handlePaymentWebhook', () => {
    it('should process webhook and return received: true', async () => {
      paymentWebhookService.processWebhook.mockResolvedValue();

      const result = await controller.handlePaymentWebhook(webhookPayload);

      expect(paymentWebhookService.processWebhook).toHaveBeenCalledWith(webhookPayload);
      expect(result).toEqual({ received: true });
    });

    it('should propagate NotFoundException to exception filter', async () => {
      paymentWebhookService.processWebhook.mockRejectedValue(
        new NotFoundException('Payment with reference PAY-NOTFOUND not found')
      );

      await expect(controller.handlePaymentWebhook(webhookPayload)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('route decorators', () => {
    it('should have POST decorator on handlePaymentWebhook', () => {
      const metadata = Reflect.getMetadata('method', controller.handlePaymentWebhook);
      expect(metadata).toBeDefined();
    });
  });
});
