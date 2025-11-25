import { createZodDto } from 'nestjs-zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export class PaymentResponseDto extends createZodDto(PaymentResponseSchema) {
  @ApiProperty({
    description: 'Payment unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  declare id: string;

  @ApiProperty({
    description: 'Payment reference',
    example: 'PAY-ABC12345',
  })
  declare reference: string;

  @ApiProperty({
    description: 'User ID who initiated the payment',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  declare user_id: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 10000,
  })
  declare amount: number;

  @ApiProperty({
    description: 'Payment currency',
    enum: PaymentCurrency,
    example: PaymentCurrency.UGX,
  })
  declare currency: PaymentCurrency;

  @ApiProperty({
    description: 'Payment method',
    enum: PaymentMethod,
    example: PaymentMethod.MOBILE_MONEY,
  })
  declare payment_method: PaymentMethod;

  @ApiProperty({
    description: 'Customer phone number',
    example: '+256700000000',
  })
  declare customer_phone: string;

  @ApiProperty({
    description: 'Customer email',
    example: 'customer@example.com',
  })
  declare customer_email: string;

  @ApiProperty({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  declare status: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Provider reference',
    example: 'PRV-123456',
    nullable: true,
  })
  declare provider_reference: string | null;

  @ApiPropertyOptional({
    description: 'Provider transaction ID',
    example: 'TXN-789012',
    nullable: true,
  })
  declare provider_transaction_id: string | null;

  @ApiPropertyOptional({
    description: 'Failure reason if payment failed',
    example: 'Insufficient funds',
    nullable: true,
  })
  declare failure_reason: string | null;

  @ApiProperty({
    description: 'Payment creation timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  declare created_at: string;

  @ApiProperty({
    description: 'Payment last update timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  declare updated_at: string;
}

export type PaymentResponse = z.infer<typeof PaymentResponseSchema>;

export const PaymentStatusLogResponseSchema = z.object({
  id: z.string().uuid(),
  payment_id: z.string().uuid(),
  from_status: z.nativeEnum(PaymentStatus),
  to_status: z.nativeEnum(PaymentStatus),
  reason: z.string().nullable(),
  triggered_by: z.string().nullable(),
  created_at: z.string().datetime(),
});

export type PaymentStatusLogResponse = z.infer<
  typeof PaymentStatusLogResponseSchema
>;
