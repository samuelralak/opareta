import { createZodDto } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const WebhookPayloadSchema = z.object({
  payment_reference: z.string().min(1, 'Payment reference is required'),
  provider_transaction_id: z
    .string()
    .min(1, 'Provider transaction ID is required'),
  status: z.enum(['SUCCESS', 'FAILED']),
  timestamp: z.string().datetime({ offset: true }),
  webhook_id: z.string().min(1, 'Webhook ID is required'),
});

export class WebhookPayloadDto extends createZodDto(WebhookPayloadSchema) {
  @ApiProperty({
    description: 'Payment reference from the original payment request',
    example: 'PAY-ABC12345',
  })
  declare payment_reference: string;

  @ApiProperty({
    description: 'Transaction ID from the payment provider',
    example: 'TXN-789012',
  })
  declare provider_transaction_id: string;

  @ApiProperty({
    description: 'Payment status from provider',
    enum: ['SUCCESS', 'FAILED'],
    example: 'SUCCESS',
  })
  declare status: 'SUCCESS' | 'FAILED';

  @ApiProperty({
    description: 'Timestamp of the webhook event',
    example: '2025-01-01T00:00:00.000Z',
  })
  declare timestamp: string;

  @ApiProperty({
    description: 'Unique webhook event identifier',
    example: 'WH-123456',
  })
  declare webhook_id: string;
}

export type WebhookPayloadInput = z.infer<typeof WebhookPayloadSchema>;
