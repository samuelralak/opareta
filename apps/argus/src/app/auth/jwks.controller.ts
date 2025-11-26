import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@ApiTags('auth')
@Controller('.well-known')
export class JwksController {
  private readonly jwks: { keys: object[] };

  constructor(private readonly configService: ConfigService) {
    const publicKeyBase64 = this.configService.get<string>('JWT_PUBLIC_KEY');

    if (!publicKeyBase64) {
      throw new Error('JWT_PUBLIC_KEY must be set');
    }

    const publicKey = Buffer.from(publicKeyBase64, 'base64').toString('utf8');
    const keyObject = crypto.createPublicKey(publicKey);
    const jwk = keyObject.export({ format: 'jwk' });
    const keyId = this.configService.get<string>('JWT_KEY_ID', 'argus-key-1');

    this.jwks = {
      keys: [
        {
          ...jwk,
          kid: keyId,
          use: 'sig',
          alg: 'RS256',
        },
      ],
    };
  }

  @Get('jwks.json')
  @ApiOperation({ summary: 'Get JSON Web Key Set for token verification' })
  getJwks() {
    return this.jwks;
  }
}
