import { createZodDto } from 'nestjs-zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { z } from 'zod';
import { PaymentStatus } from '../entities';

export const UpdatePaymentStatusSchema = z.object({
  status: z.nativeEnum(PaymentStatus),
  reason: z.string().optional(),
});

export class UpdatePaymentStatusDto extends createZodDto(
  UpdatePaymentStatusSchema
) {
  @ApiProperty({
    description: 'New payment status',
    enum: PaymentStatus,
    example: PaymentStatus.SUCCESS,
  })
  declare status: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Reason for status change',
    example: 'Payment confirmed by provider',
  })
  declare reason?: string;
}

export type UpdatePaymentStatusInput = z.infer<typeof UpdatePaymentStatusSchema>;
