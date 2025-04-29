import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { DatabaseConfigModule, DatabaseConfigService } from './config';
import { DatabaseHealthIndicator } from './database.health-indicator';
import { defineConfig } from '@mikro-orm/mysql';

@Module({})
export class DatabaseModule {
  static forRoot() {
    return {
      module: DatabaseModule,
      imports: [
        MikroOrmModule.forRootAsync({
          useFactory: (databaseConfig: DatabaseConfigService) =>
            defineConfig({
              host: databaseConfig.host,
              port: databaseConfig.port,
              user: databaseConfig.user,
              password: databaseConfig.password,
              dbName: databaseConfig.name,
              entitiesTs: ['./src/**/*.entity.ts'],
              entities: ['./dist/**/*.entity.js'],
              discovery: {
                warnWhenNoEntities: false,
              },
              debug: process.env.NODE_ENV !== 'production',
            }),
          imports: [DatabaseConfigModule],
          inject: [DatabaseConfigService],
        }),
      ],
      providers: [DatabaseHealthIndicator],
    };
  }
}
