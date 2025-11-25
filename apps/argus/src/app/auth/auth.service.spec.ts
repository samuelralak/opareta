import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users';
import { AccessToken } from './entities';
import { TokenCacheService } from '@opareta/common';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let tokenCacheService: jest.Mocked<TokenCacheService>;
  let accessTokenRepository: jest.Mocked<Repository<AccessToken>>;

  const mockUser = {
    id: 'user-uuid',
    phone_number: '+254712345678',
    email: 'test@example.com',
    password: 'hashed-password',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByPhoneNumber: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('2h'),
          },
        },
        {
          provide: TokenCacheService,
          useValue: {
            invalidateToken: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AccessToken),
          useValue: {
            save: jest.fn(),
            update: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    tokenCacheService = module.get(TokenCacheService);
    accessTokenRepository = module.get(getRepositoryToken(AccessToken));
  });

  describe('login', () => {
    const loginDto = { phone_number: '+254712345678', password: 'password123' };

    it('should return token for valid credentials', async () => {
      usersService.findByPhoneNumber.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('jwt-token');
      accessTokenRepository.save.mockResolvedValue({} as AccessToken);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        access_token: 'jwt-token',
        expires_in: 7200,
      });
      expect(accessTokenRepository.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      usersService.findByPhoneNumber.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      usersService.findByPhoneNumber.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException('Invalid credentials'),
      );
    });
  });

  describe('logout', () => {
    it('should invalidate token in database and cache', async () => {
      const token = 'jwt-token';
      accessTokenRepository.update.mockResolvedValue({ affected: 1 } as never);
      tokenCacheService.invalidateToken.mockResolvedValue();

      await service.logout(token);

      expect(accessTokenRepository.update).toHaveBeenCalled();
      expect(tokenCacheService.invalidateToken).toHaveBeenCalledWith(
        token,
        7200000,
      );
    });
  });

  describe('isTokenValid', () => {
    it('should return true for valid non-invalidated token', async () => {
      const futureDate = new Date(Date.now() + 3600000);
      accessTokenRepository.findOne.mockResolvedValue({
        expires_at: futureDate,
        invalidated_at: null,
      } as AccessToken);

      const result = await service.isTokenValid('valid-token');

      expect(result).toBe(true);
    });

    it('should return false for expired token', async () => {
      const pastDate = new Date(Date.now() - 3600000);
      accessTokenRepository.findOne.mockResolvedValue({
        expires_at: pastDate,
        invalidated_at: null,
      } as AccessToken);

      const result = await service.isTokenValid('expired-token');

      expect(result).toBe(false);
    });

    it('should return false for non-existent token', async () => {
      accessTokenRepository.findOne.mockResolvedValue(null);

      const result = await service.isTokenValid('unknown-token');

      expect(result).toBe(false);
    });
  });
});
