import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { TokenCacheService } from './token-cache.service';
import * as crypto from 'crypto';

describe('TokenCacheService', () => {
  let service: TokenCacheService;
  let mockCache: { get: jest.Mock; set: jest.Mock };

  beforeEach(async () => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenCacheService,
        { provide: CACHE_MANAGER, useValue: mockCache },
      ],
    }).compile();

    service = module.get<TokenCacheService>(TokenCacheService);
  });

  describe('invalidateToken', () => {
    it('should store hashed token in cache with TTL', async () => {
      const token = 'test-jwt-token';
      const ttlMs = 7200000;
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');

      await service.invalidateToken(token, ttlMs);

      expect(mockCache.set).toHaveBeenCalledWith(
        `token:invalidated:${expectedHash}`,
        '1',
        ttlMs,
      );
    });
  });

  describe('isTokenInvalidated', () => {
    it('should return true when token is in cache', async () => {
      mockCache.get.mockResolvedValue('1');

      const result = await service.isTokenInvalidated('test-token');

      expect(result).toBe(true);
    });

    it('should return false when token is not in cache (null)', async () => {
      mockCache.get.mockResolvedValue(null);

      const result = await service.isTokenInvalidated('test-token');

      expect(result).toBe(false);
    });

    it('should return false when token is not in cache (undefined)', async () => {
      mockCache.get.mockResolvedValue(undefined);

      const result = await service.isTokenInvalidated('test-token');

      expect(result).toBe(false);
    });

    it('should query cache with hashed token', async () => {
      const token = 'test-jwt-token';
      const expectedHash = crypto.createHash('sha256').update(token).digest('hex');
      mockCache.get.mockResolvedValue(null);

      await service.isTokenInvalidated(token);

      expect(mockCache.get).toHaveBeenCalledWith(`token:invalidated:${expectedHash}`);
    });
  });
});
