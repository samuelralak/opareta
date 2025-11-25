import { createZodDto } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';
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

export class CreatePaymentDto extends createZodDto(CreatePaymentSchema) {
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
    description: 'Customer email address',
    example: 'customer@example.com',
  })
  declare customer_email: string;
}

export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
