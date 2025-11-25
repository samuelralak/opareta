import { createZodDto } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const LoginSchema = z.object({
  phone_number: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'),
  password: z.string().min(1, 'Password is required'),
});

export class LoginDto extends createZodDto(LoginSchema) {
  @ApiProperty({
    description: 'User phone number',
    example: '+254712345678',
  })
  declare phone_number: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123',
  })
  declare password: string;
}

export type LoginInput = z.infer<typeof LoginSchema>;
