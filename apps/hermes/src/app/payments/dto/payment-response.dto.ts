import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaymentCurrency, PaymentMethod, PaymentStatus } from '../entities';

export const PaymentResponseSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  user_id: z.string().uuid(),
  amount: z.number(),
  currency: z.nativeEnum(PaymentCurrency),
  payment_method: z.nativeEnum(PaymentMethod),
  customer_phone: z.string(),
  customer_email: z.string().email(),
  status: z.nativeEnum(PaymentStatus),
  provider_reference: z.string().nullable(),
  provider_transaction_id: z.string().nullable(),
  failure_reason: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export class PaymentResponseDto extends createZodDto(PaymentResponseSchema) {}

export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;

export const PaymentStatusLogResponseSchema = z.object({
  id: z.string().uuid(),
  payment_id: z.string().uuid(),
  from_status: z.nativeEnum(PaymentStatus),
  to_status: z.nativeEnum(PaymentStatus),
  reason: z.string().nullable(),
  triggered_by: z.string().nullable(),
  created_at: z.date(),
});

export type PaymentStatusLogResponse = z.infer<
  typeof PaymentStatusLogResponseSchema
>;
