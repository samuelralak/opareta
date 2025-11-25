import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { TokenCacheService } from '../cache';
import { JwtPayload } from '../types';

@Injectable()
export class JwksAuthGuard implements CanActivate {
  private readonly client: jwksClient.JwksClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly tokenCacheService: TokenCacheService,
  ) {
    const jwksUri = this.configService.getOrThrow<string>('JWKS_URI');
    this.client = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Missing authorization token');
    }

    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded?.header?.kid) {
        throw new UnauthorizedException('Invalid token format');
      }

      const key = await this.client.getSigningKey(decoded.header.kid);
      const publicKey = key.getPublicKey();

      const payload = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

      const isInvalidated = await this.tokenCacheService.isTokenInvalidated(token);
      if (isInvalidated) {
        throw new UnauthorizedException('Token has been invalidated');
      }

      (request as Request & { user: JwtPayload }).user = payload as JwtPayload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
