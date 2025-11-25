import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as crypto from 'crypto';

const INVALIDATED_PREFIX = 'token:invalidated:';

@Injectable()
export class TokenCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async invalidateToken(token: string, ttlMs: number): Promise<void> {
    const hash = this.hashToken(token);
    await this.cache.set(`${INVALIDATED_PREFIX}${hash}`, '1', ttlMs);
  }

  async isTokenInvalidated(token: string): Promise<boolean> {
    const hash = this.hashToken(token);
    const result = await this.cache.get(`${INVALIDATED_PREFIX}${hash}`);
    return result !== null && result !== undefined;
  }
}
