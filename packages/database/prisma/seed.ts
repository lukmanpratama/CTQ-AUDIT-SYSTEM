// packages/database/prisma/seed.ts
// Development seed data for CTQ Audit RQC

import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ─────────────────────────────────────────────
  // Master Area
  // ─────────────────────────────────────────────
  const areas = await Promise.all([
    prisma.masterArea.upsert({
      where: { area: 'TREATMENT' },
      update: {},
      create: { area: 'TREATMENT' },
    }),
    prisma.masterArea.upsert({
      where: { area: 'SEWING' },
      update: {},
      create: { area: 'SEWING' },
    }),
    prisma.masterArea.upsert({
      where: { area: 'ASSEMBLY' },
      update: {},
      create: { area: 'ASSEMBLY' },
    }),
  ]);
  console.log(`✅ Master Area: ${areas.length} records`);

  // ─────────────────────────────────────────────
  // Master Process
  // ─────────────────────────────────────────────
  const processes = await Promise.all([
    prisma.masterProcess.upsert({
      where: { process: 'NOSEW' },
      update: {},
      create: { process: 'NOSEW', ctq: 'No-sew bonding quality', riskLevel: 'HIGH' },
    }),
    prisma.masterProcess.upsert({
      where: { process: 'SPRAY COLLAR' },
      update: {},
      create: { process: 'SPRAY COLLAR', ctq: 'Collar spray adhesion', riskLevel: 'MEDIUM' },
    }),
    prisma.masterProcess.upsert({
      where: { process: 'INVERT COLLAR LINING' },
      update: {},
      create: { process: 'INVERT COLLAR LINING', riskLevel: 'MEDIUM' },
    }),
  ]);
  console.log(`✅ Master Process: ${processes.length} records`);

  // ─────────────────────────────────────────────
  // Master Defect
  // ─────────────────────────────────────────────
  const defects = await Promise.all([
    prisma.masterDefect.upsert({ where: { defect: 'PEEL OFF' }, update: {}, create: { defect: 'PEEL OFF' } }),
    prisma.masterDefect.upsert({ where: { defect: 'DIRTY' }, update: {}, create: { defect: 'DIRTY' } }),
    prisma.masterDefect.upsert({ where: { defect: 'OVERMELTING' }, update: {}, create: { defect: 'OVERMELTING' } }),
    prisma.masterDefect.upsert({ where: { defect: 'MISALIGNMENT' }, update: {}, create: { defect: 'MISALIGNMENT' } }),
    prisma.masterDefect.upsert({ where: { defect: 'OPEN SEAM' }, update: {}, create: { defect: 'OPEN SEAM' } }),
  ]);
  console.log(`✅ Master Defect: ${defects.length} records`);

  // ─────────────────────────────────────────────
  // Master Factory
  // ─────────────────────────────────────────────
  const factory = await prisma.masterFactory.upsert({
    where: { factory: 'FACTORY A' },
    update: {},
    create: { factory: 'FACTORY A' },
  });
  console.log(`✅ Master Factory: ${factory.factory}`);

  // ─────────────────────────────────────────────
  // Master User (Admin + RQC)
  // ─────────────────────────────────────────────
  const customAdminHash = await argon2.hash('admin123$%');
  const adminHash = await argon2.hash('Admin@1234');
  const rqcHash = await argon2.hash('Rqc@1234');

  await prisma.masterUser.upsert({
    where: { nik: 'admin' },
    update: { passwordHash: customAdminHash, role: 'ADMIN' },
    create: { nik: 'admin', namaUser: 'System Admin', passwordHash: customAdminHash, role: 'ADMIN' },
  });

  await prisma.masterUser.upsert({
    where: { nik: 'ADMIN001' },
    update: {},
    create: { nik: 'ADMIN001', namaUser: 'System Admin', passwordHash: adminHash, role: 'ADMIN' },
  });
  await prisma.masterUser.upsert({
    where: { nik: 'RQC001' },
    update: {},
    create: { nik: 'RQC001', namaUser: 'RQC Inspector One', passwordHash: rqcHash, role: 'RQC' },
  });
  console.log(`✅ Master User: 2 records (passwords hashed with Argon2id)`);

  // ─────────────────────────────────────────────
  // Master PO
  // ─────────────────────────────────────────────
  const po = await prisma.masterPo.upsert({
    where: { po: 'PO001' },
    update: {},
    create: { po: 'PO001', article: 'HP-2026-001', model: 'HYPERPATH MEN', qtyOrder: 500 },
  });
  console.log(`✅ Master PO: ${po.po}`);

  // ─────────────────────────────────────────────
  // Setup Model
  // ─────────────────────────────────────────────
  const setupModel = await prisma.setupModel.upsert({
    where: { modelName: 'HYPERPATH' },
    update: {},
    create: { modelName: 'HYPERPATH', isActive: true },
  });
  console.log(`✅ Setup Model: ${setupModel.modelName}`);

  // ─────────────────────────────────────────────
  // Model PO Mapping (controlled normalization)
  // ─────────────────────────────────────────────
  await prisma.modelPoMapping.upsert({
    where: { mappingId: 1n },
    update: {},
    create: {
      setupModelId: setupModel.setupModelId,
      poModelPattern: 'HYPERPATH MEN',
      normalizedModel: 'HYPERPATH',
      isActive: true,
    },
  });
  await prisma.modelPoMapping.upsert({
    where: { mappingId: 2n },
    update: {},
    create: {
      setupModelId: setupModel.setupModelId,
      poModelPattern: 'HYPERPATH WOMEN',
      normalizedModel: 'HYPERPATH',
      isActive: true,
    },
  });
  console.log(`✅ Model PO Mapping: 2 patterns for HYPERPATH`);

  // ─────────────────────────────────────────────
  // Setup Area (TREATMENT for HYPERPATH)
  // ─────────────────────────────────────────────
  const treatmentArea = areas.find((a) => a.area === 'TREATMENT')!;
  const setupArea = await prisma.setupArea.upsert({
    where: { setupModelId_areaId: { setupModelId: setupModel.setupModelId, areaId: treatmentArea.areaId } },
    update: {},
    create: { setupModelId: setupModel.setupModelId, areaId: treatmentArea.areaId },
  });
  console.log(`✅ Setup Area: TREATMENT for HYPERPATH`);

  // ─────────────────────────────────────────────
  // Setup Process (NOSEW for TREATMENT)
  // ─────────────────────────────────────────────
  const nosewProcess = processes.find((p) => p.process === 'NOSEW')!;
  const setupProcess = await prisma.setupProcess.upsert({
    where: { setupAreaId_processId: { setupAreaId: setupArea.setupAreaId, processId: nosewProcess.processId } },
    update: {},
    create: { setupAreaId: setupArea.setupAreaId, processId: nosewProcess.processId },
  });
  console.log(`✅ Setup Process: NOSEW for TREATMENT`);

  // ─────────────────────────────────────────────
  // Setup Defect (PEEL OFF + DIRTY for NOSEW)
  // ─────────────────────────────────────────────
  const peelOff = defects.find((d) => d.defect === 'PEEL OFF')!;
  const dirty = defects.find((d) => d.defect === 'DIRTY')!;
  const overmelting = defects.find((d) => d.defect === 'OVERMELTING')!;

  await prisma.setupDefect.upsert({
    where: { setupProcessId_defectId: { setupProcessId: setupProcess.setupProcessId, defectId: peelOff.defectId } },
    update: {},
    create: { setupProcessId: setupProcess.setupProcessId, defectId: peelOff.defectId },
  });
  await prisma.setupDefect.upsert({
    where: { setupProcessId_defectId: { setupProcessId: setupProcess.setupProcessId, defectId: dirty.defectId } },
    update: {},
    create: { setupProcessId: setupProcess.setupProcessId, defectId: dirty.defectId },
  });
  await prisma.setupDefect.upsert({
    where: { setupProcessId_defectId: { setupProcessId: setupProcess.setupProcessId, defectId: overmelting.defectId } },
    update: {},
    create: { setupProcessId: setupProcess.setupProcessId, defectId: overmelting.defectId },
  });
  console.log(`✅ Setup Defect: PEEL OFF, DIRTY, OVERMELTING for NOSEW`);

  console.log('\n🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
