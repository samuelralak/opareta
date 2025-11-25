import { createZodDto } from 'nestjs-zod';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().int().positive(),
});

export class TokenResponseDto extends createZodDto(TokenResponseSchema) {
  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  declare access_token: string;

  @ApiProperty({
    description: 'Token expiration time in seconds',
    example: 7200,
  })
  declare expires_in: number;
}

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
