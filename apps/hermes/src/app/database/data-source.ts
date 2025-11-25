import 'dotenv/config';
import { DataSource } from 'typeorm';
import databaseConfig from './database.config';
import { migrations } from './migrations';

export default new DataSource({
  ...databaseConfig(),
  entities: [__dirname + '/../**/*.entity.ts'],
  migrations,
});
