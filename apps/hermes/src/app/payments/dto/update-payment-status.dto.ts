import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaymentStatus } from '../entities';

export const UpdatePaymentStatusSchema = z.object({
  status: z.nativeEnum(PaymentStatus),
  reason: z.string().optional(),
});

export class UpdatePaymentStatusDto extends createZodDto(
  UpdatePaymentStatusSchema
) {}

export type UpdatePaymentStatusInput = z.infer<typeof UpdatePaymentStatusSchema>;
