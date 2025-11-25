import { randomUUID } from 'crypto';

export interface InitiatePaymentRequest {
  reference: string;
  amount: number;
  currency: 'UGX' | 'USD';
  phone_number: string;
  callback_url: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  provider_reference: string;
  message: string;
}

export interface WebhookPayload {
  payment_reference: string;
  provider_transaction_id: string;
  status: 'SUCCESS' | 'FAILED';
  timestamp: string;
  webhook_id: string;
}

export interface DummyProviderConfig {
  callbackUrl: string;
  successRate?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
}

export class DummyProvider {
  private readonly callbackUrl: string;
  private readonly successRate: number;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(config: DummyProviderConfig) {
    this.callbackUrl = config.callbackUrl;
    this.successRate = config.successRate ?? 0.8;
    this.minDelayMs = config.minDelayMs ?? 2000;
    this.maxDelayMs = config.maxDelayMs ?? 5000;
  }

  async initiatePayment(
    request: InitiatePaymentRequest
  ): Promise<InitiatePaymentResponse> {
    const providerReference = `PRV-${randomUUID().slice(0, 8).toUpperCase()}`;

    this.scheduleWebhookCallback(request.reference, providerReference);

    return {
      success: true,
      provider_reference: providerReference,
      message: 'Payment initiated successfully',
    };
  }

  private scheduleWebhookCallback(
    paymentReference: string,
    providerReference: string
  ): void {
    const delay =
      Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs)) +
      this.minDelayMs;
    const success = Math.random() < this.successRate;

    setTimeout(async () => {
      const webhookPayload: WebhookPayload = {
        payment_reference: paymentReference,
        provider_transaction_id: providerReference,
        status: success ? 'SUCCESS' : 'FAILED',
        timestamp: new Date().toISOString(),
        webhook_id: `WH-${randomUUID()}`,
      };

      try {
        await fetch(this.callbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(webhookPayload),
        });
      } catch (error) {
        console.error('Webhook delivery failed:', error);
      }
    }, delay);
  }
}
