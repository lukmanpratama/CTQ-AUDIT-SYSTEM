// apps/api/src/prisma/prisma.service.ts
// NestJS Prisma service — lifecycle-aware singleton

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // No 'query' events: nothing subscribes to them, so emitting one per query was pure overhead
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'stdout', level: 'error' },
              { emit: 'stdout', level: 'warn' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit() {
    // Postgres runs in Docker and is often still starting (or restarting) when the API boots.
    // Retry instead of crashing, so the API comes up by itself once the database is ready.
    const maxAttempts = 30;
    for (let attempt = 1; ; attempt++) {
      try {
        await this.$connect();
        this.logger.log('✅ Prisma connected to PostgreSQL');
        return;
      } catch (error) {
        if (attempt >= maxAttempts) throw error;
        const message = error instanceof Error ? error.message.split('\n').pop() : String(error);
        this.logger.warn(`PostgreSQL not reachable (attempt ${attempt}/${maxAttempts}): ${message}. Retrying in 5s...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma disconnected from PostgreSQL');
  }

  /**
   * Clean database for testing purposes.
   * ONLY callable in test environment.
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase() can only be called in test environment');
    }
    const tableNames = [
      'rqc_inspection',
      'rqc_process',
      'rqc_area',
      'rqc_header',
      'setup_defect',
      'setup_process',
      'setup_area',
      'model_po_mapping',
      'setup_model',
      'master_po',
      'master_user',
      'master_factory',
      'master_defect',
      'master_process',
      'master_area',
      'file_asset',
    ];
    for (const table of tableNames) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
    }
  }
}
