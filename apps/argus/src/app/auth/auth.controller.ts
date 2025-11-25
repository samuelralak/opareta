import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwksAuthGuard } from '@opareta/common';
import {
  RegisterDto,
  LoginDto,
  UserResponseDto,
  TokenResponseDto,
  TokenPayloadDto,
} from './dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() registerDto: RegisterDto): Promise<UserResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with phone number and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: TokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() loginDto: LoginDto): Promise<TokenResponseDto> {
    return this.authService.login(loginDto);
  }

  @Get('verify')
  @UseGuards(JwksAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify JWT token and return payload' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid',
    type: TokenPayloadDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async verify(@Request() req: { user: TokenPayloadDto }): Promise<TokenPayloadDto> {
    return req.user;
  }

  @Post('logout')
  @UseGuards(JwksAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and invalidate token' })
  @ApiResponse({ status: 204, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async logout(@Headers('authorization') authorization: string): Promise<void> {
    const token = authorization?.replace('Bearer ', '');
    await this.authService.logout(token);
  }
}
