import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';

@ApiTags('auth')
@Controller('.well-known')
export class JwksController {
  private readonly jwks: { keys: object[] };

  constructor() {
    const publicKey = readFileSync(
      join(process.cwd(), 'apps/argus/keys/public.pem'),
    );
    const keyObject = crypto.createPublicKey(publicKey);
    const jwk = keyObject.export({ format: 'jwk' });

    this.jwks = {
      keys: [
        {
          ...jwk,
          kid: 'argus-key-1',
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
