import { ApiProperty } from '@nestjs/swagger';
import { IsPhoneNumber, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User phone number',
    example: '+254712345678',
  })
  @IsPhoneNumber()
  phone_number!: string;

  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123',
  })
  @IsString()
  password!: string;
}
