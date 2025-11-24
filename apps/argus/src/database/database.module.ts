import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';
import { createDatabase } from 'typeorm-extension';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async (config: ConfigService) => {
        const options: DataSourceOptions = {
          type: 'postgres',
          host: config.get('DB_HOST'),
          port: config.get<number>('DB_PORT', 5432),
          username: config.get('DB_USERNAME'),
          password: config.get('DB_PASSWORD'),
          database: config.get('DB_NAME'),
          autoLoadEntities: true,
          synchronize: config.get('NODE_ENV') !== 'production',
        };

        await createDatabase({
          options,
          ifNotExist: true,
          initialDatabase: 'postgres',
        });

        return options;
      },
      inject: [ConfigService],
    }),
  ],
})
export class DatabaseModule {}
