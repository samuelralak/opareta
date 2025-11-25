import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwksAuthGuard } from './jwks-auth.guard';
import { TokenCacheService } from '../cache';
import * as jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');
jest.mock('jwks-rsa', () => {
  return jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn().mockResolvedValue({
      getPublicKey: () => 'mock-public-key',
    }),
  }));
});

describe('JwksAuthGuard', () => {
  let guard: JwksAuthGuard;
  let tokenCacheService: jest.Mocked<TokenCacheService>;

  const mockRequest = {
    headers: { authorization: 'Bearer valid-token' },
    user: undefined as unknown,
  };

  const mockExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
  } as ExecutionContext;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRequest.user = undefined;
    mockRequest.headers.authorization = 'Bearer valid-token';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwksAuthGuard,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('http://localhost:3000/api/.well-known/jwks.json'),
          },
        },
        {
          provide: TokenCacheService,
          useValue: {
            isTokenInvalidated: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    guard = module.get<JwksAuthGuard>(JwksAuthGuard);
    tokenCacheService = module.get(TokenCacheService);
  });

  describe('canActivate', () => {
    it('should throw UnauthorizedException when no authorization header', async () => {
      mockRequest.headers.authorization = undefined as unknown as string;

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Missing authorization token'),
      );
    });

    it('should throw UnauthorizedException when authorization is not Bearer', async () => {
      mockRequest.headers.authorization = 'Basic credentials';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Missing authorization token'),
      );
    });

    it('should throw UnauthorizedException when token has no kid', async () => {
      (jwt.decode as jest.Mock).mockReturnValue({ header: {} });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is invalidated', async () => {
      const payload = { sub: 'user-id', phone_number: '+254712345678' };
      (jwt.decode as jest.Mock).mockReturnValue({ header: { kid: 'key-1' } });
      (jwt.verify as jest.Mock).mockReturnValue(payload);
      (tokenCacheService.isTokenInvalidated as jest.Mock).mockResolvedValue(true);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Token has been invalidated'),
      );
    });

    it('should attach user to request and return true for valid token', async () => {
      const payload = { sub: 'user-id', phone_number: '+254712345678', iat: 123, exp: 456 };
      (jwt.decode as jest.Mock).mockReturnValue({ header: { kid: 'key-1' } });
      (jwt.verify as jest.Mock).mockReturnValue(payload);
      (tokenCacheService.isTokenInvalidated as jest.Mock).mockResolvedValue(false);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(payload);
    });

    it('should throw UnauthorizedException when jwt.verify throws', async () => {
      (jwt.decode as jest.Mock).mockReturnValue({ header: { kid: 'key-1' } });
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Invalid or expired token'),
      );
    });
  });
});
