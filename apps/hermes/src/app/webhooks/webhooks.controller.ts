import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentWebhookService } from './payment-webhook.service';
import { WebhookPayloadDto } from '../payments/dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentWebhookService: PaymentWebhookService) {}

  @Post('payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle payment provider webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handlePaymentWebhook(@Body() webhookPayload: WebhookPayloadDto) {
    await this.paymentWebhookService.processWebhook(webhookPayload);
    return { received: true };
  }
}
