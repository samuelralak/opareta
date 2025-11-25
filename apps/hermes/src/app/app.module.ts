import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '@opareta/common';
import { DatabaseModule, databaseConfig } from './database';
import { PaymentsModule } from './payments/payments.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['apps/hermes/.env'],
      isGlobal: true,
      load: [databaseConfig],
    }),
    DatabaseModule,
    CommonModule,
    PaymentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
