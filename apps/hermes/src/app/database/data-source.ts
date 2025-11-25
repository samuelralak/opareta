import 'dotenv/config';
import { DataSource } from 'typeorm';
import databaseConfig from './database.config';

export default new DataSource({
  ...databaseConfig(),
  entities: [__dirname + '/../**/*.entity.ts'],
  migrations: [__dirname + '/migrations/*.ts'],
});
