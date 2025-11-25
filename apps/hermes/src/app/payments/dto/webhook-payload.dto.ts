import { createZodDto } from 'nestjs-zod';
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

export class WebhookPayloadDto extends createZodDto(WebhookPayloadSchema) {}

export type WebhookPayloadInput = z.infer<typeof WebhookPayloadSchema>;
