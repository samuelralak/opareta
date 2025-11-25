import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { UsersModule } from '../users';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { JwksController } from './jwks.controller';
import { AccessToken } from './entities';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([AccessToken]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        privateKey: readFileSync(
          join(process.cwd(), 'apps/argus/keys/private.pem'),
        ),
        publicKey: readFileSync(
          join(process.cwd(), 'apps/argus/keys/public.pem'),
        ),
        signOptions: {
          algorithm: 'RS256',
          expiresIn: config.get<string>('JWT_EXPIRATION', '2h'),
          keyid: 'argus-key-1',
        },
      }),
    }),
  ],
  controllers: [AuthController, JwksController],
  providers: [AuthService, AuthGuard],
  exports: [AuthGuard, JwtModule],
})
export class AuthModule {}
