import { ApiProperty } from '@nestjs/swagger';

export class TokenPayloadDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  sub!: string;

  @ApiProperty({ example: '+254712345678' })
  phone_number!: string;

  @ApiProperty({ example: 1704067200 })
  iat!: number;

  @ApiProperty({ example: 1704153600 })
  exp!: number;
}
