import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CommonModule } from '@opareta/common';
import { DatabaseModule, databaseConfig } from './database';
import { AuthModule } from './auth';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['apps/argus/.env'],
      isGlobal: true,
      load: [databaseConfig],
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
