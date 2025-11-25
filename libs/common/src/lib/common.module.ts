import { Module } from '@nestjs/common';
import { JwksAuthGuard } from './guards';
import { RedisCacheModule } from './cache';

@Module({
  imports: [RedisCacheModule.forRoot()],
  providers: [JwksAuthGuard],
  exports: [JwksAuthGuard, RedisCacheModule],
})
export class CommonModule {}
