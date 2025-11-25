import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users';
import { RegisterDto, LoginDto, UserResponseDto, TokenResponseDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const existingByPhone = await this.usersService.findByPhoneNumber(dto.phone_number);
    if (existingByPhone) {
      throw new ConflictException('Phone number already registered');
    }

    const existingByEmail = await this.usersService.findByEmail(dto.email);
    if (existingByEmail) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.usersService.create({
      phone_number: dto.phone_number,
      email: dto.email,
      password: hashedPassword,
    });

    return {
      id: user.id,
      phone_number: user.phone_number,
      email: user.email,
      created_at: user.created_at,
    };
  }

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.usersService.findByPhoneNumber(dto.phone_number);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, phone_number: user.phone_number };
    const access_token = await this.jwtService.signAsync(payload);

    return { access_token };
  }
}
