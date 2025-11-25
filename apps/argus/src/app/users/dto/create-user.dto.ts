import { createZodDto } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateUserSchema = z.object({
  phone_number: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {
  @ApiProperty({
    description: 'User phone number in international format',
    example: '+254712345678',
  })
  declare phone_number: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  declare email: string;

  @ApiProperty({
    description: 'User password (minimum 8 characters)',
    example: 'SecurePass123',
    minLength: 8,
  })
  declare password: string;
}

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
