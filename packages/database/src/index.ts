// packages/database/src/index.ts
// Central export point for Prisma client

export { PrismaClient } from '@prisma/client';
export * from '@prisma/client';

// Singleton pattern for Prisma client
// Prevents multiple instances in development (Next.js hot reload)
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
