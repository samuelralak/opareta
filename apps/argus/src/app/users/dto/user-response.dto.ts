import { createZodDto } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  phone_number: z.string(),
  email: z.string().email(),
  created_at: z.string().datetime(),
});

export class UserResponseDto extends createZodDto(UserResponseSchema) {
  @ApiProperty({
    description: 'User unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  declare id: string;

  @ApiProperty({
    description: 'User phone number',
    example: '+254712345678',
  })
  declare phone_number: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  declare email: string;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2025-01-01T00:00:00.000Z',
  })
  declare created_at: string;
}

export type UserResponse = z.infer<typeof UserResponseSchema>;
