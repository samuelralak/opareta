import { Module } from '@nestjs/common';
import { JwksAuthGuard } from './guards';

@Module({
  providers: [JwksAuthGuard],
  exports: [JwksAuthGuard],
})
export class CommonModule {}
