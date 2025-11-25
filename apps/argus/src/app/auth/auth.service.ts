import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { TokenCacheService } from '@opareta/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users';
import { LoginDto, TokenResponseDto } from './dto';
import { AccessToken } from './entities';

const EXPIRATION_MAP: Record<string, number> = {
  '1h': 3600,
  '2h': 7200,
  '24h': 86400,
};

@Injectable()
export class AuthService {
  private readonly expiresIn: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenCacheService: TokenCacheService,
    @InjectRepository(AccessToken)
    private readonly accessTokenRepository: Repository<AccessToken>,
  ) {
    const expiration = this.configService.get<string>('JWT_EXPIRATION', '2h');
    this.expiresIn = EXPIRATION_MAP[expiration] ?? 7200;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const user = await this.usersService.findByPhoneNumber(dto.phone_number);
    const isValid = user && (await bcrypt.compare(dto.password, user.password));

    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, phone_number: user.phone_number };
    const access_token = await this.jwtService.signAsync(payload);

    await this.accessTokenRepository.save({
      user_id: user.id,
      token_hash: this.hashToken(access_token),
      expires_at: new Date(Date.now() + this.expiresIn * 1000),
    });

    return { access_token, expires_in: this.expiresIn };
  }

  async logout(token: string): Promise<void> {
    const tokenHash = this.hashToken(token);

    await this.accessTokenRepository.update(
      { token_hash: tokenHash },
      { invalidated_at: new Date() },
    );

    await this.tokenCacheService.invalidateToken(token, this.expiresIn * 1000);
  }

  async isTokenValid(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const accessToken = await this.accessTokenRepository.findOne({
      where: {
        token_hash: tokenHash,
        invalidated_at: IsNull(),
      },
    });
    return !!accessToken && accessToken.expires_at > new Date();
  }
}
