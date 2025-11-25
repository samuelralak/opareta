import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaymentCurrency, PaymentMethod } from '../entities';

export const CreatePaymentSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.nativeEnum(PaymentCurrency),
  payment_method: z.nativeEnum(PaymentMethod),
  customer_phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'),
  customer_email: z.string().email('Invalid email format'),
});

export class CreatePaymentDto extends createZodDto(CreatePaymentSchema) {}

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
