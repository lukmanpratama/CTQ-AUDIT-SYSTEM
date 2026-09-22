// apps/api/src/prisma/prisma.service.ts
// NestJS Prisma service — lifecycle-aware singleton

import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? [
              { emit: 'event', level: 'query' },
              { emit: 'stdout', level: 'error' },
              { emit: 'stdout', level: 'warn' },
            ]
          : [{ emit: 'stdout', level: 'error' }],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('✅ Prisma connected to PostgreSQL');
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
