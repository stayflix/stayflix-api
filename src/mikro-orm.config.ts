import { defineConfig, Options } from '@mikro-orm/mysql';
require('dotenv').config();

const config: Options = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT) || 3006,
  user: process.env.DATABASE_USER || 'user',
  password: process.env.DATABASE_PASSWORD || 'user',
  dbName: process.env.DATABASE_NAME || 'stayflix',
  entitiesTs: ['./src/**/*.entity.ts'],
  entities: ['./dist/**/*.entity.js'],
  baseDir: __dirname + '/..',
  migrations: {
    tableName: 'migrations',
    path: './src/migrations',
    transactional: true,
    disableForeignKeys: true,
    allOrNothing: true,
    dropTables: true,
  },
  debug: ['query'],
};

export default defineConfig(config);
