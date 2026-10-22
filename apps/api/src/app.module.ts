// apps/api/src/app.module.ts
// Root NestJS module — wires all domain modules

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ModelsModule } from './models/models.module';
import { PoModule } from './po/po.module';
import { MasterModule } from './master/master.module';
import { CtqSetupModule } from './ctq-setup/ctq-setup.module';
import { RqcModule } from './rqc/rqc.module';
import { FilesModule } from './files/files.module';
import { TqcModule } from './tqc/tqc.module';
import { TqcSetupDefectModule } from './tqc-setup-defect/tqc-setup-defect.module';
import { DataVersionModule } from './data-version/data-version.module';

@Module({
  imports: [
    // ─────────────────────────────────────────────
    // Configuration (reads .env)
    // ─────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60 * 1000,
    }),

    // ─────────────────────────────────────────────
    // Rate Limiting (basic protection)
    // ─────────────────────────────────────────────
    ThrottlerModule.forRoot([
      {
        ttl: 60000,   // 1 minute
        limit: 100,   // 100 requests per minute per IP
      },
    ]),

    // ─────────────────────────────────────────────
    // Core Infrastructure
    // ─────────────────────────────────────────────
    PrismaModule,
    HealthModule,

    // ─────────────────────────────────────────────
    // Auth + Users
    // ─────────────────────────────────────────────
    AuthModule,
    UsersModule,

    // ─────────────────────────────────────────────
    // Master Data
    // ─────────────────────────────────────────────
    MasterModule,

    // ─────────────────────────────────────────────
    // CTQ Configuration
    // ─────────────────────────────────────────────
    ModelsModule,
    PoModule,
    CtqSetupModule,

    // ─────────────────────────────────────────────
    // RQC Audit Transactions
    // ─────────────────────────────────────────────
    RqcModule,

    // ─────────────────────────────────────────────
    // File Storage (MinIO)
    // ─────────────────────────────────────────────
    FilesModule,
    TqcModule,
    TqcSetupDefectModule,

    // Clears the response cache and bumps the data version after every write
    DataVersionModule,
  ],
})
export class AppModule { }
