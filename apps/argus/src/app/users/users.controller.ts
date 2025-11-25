import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwksAuthGuard, CurrentUser, JwtPayload } from '@opareta/common';
import { UsersService } from './users.service';
import { CreateUserDto, UserResponseDto } from './dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.register(createUserDto);
  }

  @Get('me')
  @UseGuards(JwksAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Current user info',
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async me(@CurrentUser() currentUser: JwtPayload): Promise<UserResponseDto> {
    const user = await this.usersService.findById(currentUser.sub);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.usersService.toResponse(user);
  }
}
