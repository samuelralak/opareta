import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { createDatabase } from 'typeorm-extension';
import { DataSourceOptions } from 'typeorm';
import { migrations } from './migrations';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const config = configService.get<DataSourceOptions>('database');

        await createDatabase({
          options: config,
          ifNotExist: true,
          initialDatabase: 'postgres',
        });

        return {
          ...config,
          autoLoadEntities: true,
          migrations,
          migrationsRun: true,
          logging: process.env.NODE_ENV !== 'production',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
