import { Module, DynamicModule } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { TokenCacheService } from './token-cache.service';

@Module({})
export class RedisCacheModule {
  static forRoot(): DynamicModule {
    return {
      module: RedisCacheModule,
      imports: [
        CacheModule.registerAsync({
          inject: [ConfigService],
          useFactory: async (configService: ConfigService) => ({
            store: await redisStore({
              socket: {
                host: configService.get<string>('REDIS_HOST', 'localhost'),
                port: configService.get<number>('REDIS_PORT', 6379),
              },
              password: configService.get<string>('REDIS_PASSWORD'),
            }),
          }),
        }),
      ],
      providers: [TokenCacheService],
      exports: [CacheModule, TokenCacheService],
    };
  }
}
