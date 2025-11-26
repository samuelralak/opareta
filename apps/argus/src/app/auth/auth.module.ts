import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisCacheModule } from '@opareta/common';
import { UsersModule } from '../users';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwksController } from './jwks.controller';
import { AccessToken } from './entities';

@Module({
  imports: [
    UsersModule,
    RedisCacheModule.forRoot(),
    TypeOrmModule.forFeature([AccessToken]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const privateKeyBase64 = config.get<string>('JWT_PRIVATE_KEY');
        const publicKeyBase64 = config.get<string>('JWT_PUBLIC_KEY');

        if (!privateKeyBase64 || !publicKeyBase64) {
          throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set');
        }

        // JWT_EXPIRATION_SECONDS: expiration in seconds (default: 7200 = 2 hours)
        // Must be a number - string values are interpreted as milliseconds by jsonwebtoken
        const expiresIn = Number(config.get('JWT_EXPIRATION_SECONDS')) || 7200;

        return {
          privateKey: Buffer.from(privateKeyBase64, 'base64').toString('utf8'),
          publicKey: Buffer.from(publicKeyBase64, 'base64').toString('utf8'),
          signOptions: {
            algorithm: 'RS256' as const,
            expiresIn,
            keyid: config.get<string>('JWT_KEY_ID') ?? 'argus-key-1',
          },
        };
      },
    }),
  ],
  controllers: [AuthController, JwksController],
  providers: [AuthService],
  exports: [JwtModule],
})
export class AuthModule {}
