// packages/database/prisma/seed-rqc-users.ts
// Adds the RQC inspectors listed in prisma/data/rqc-users.json to master_user, each with the
// initial password from SEED_RQC_PASSWORD (repo-root .env, or the environment).
//
// rqc-users.json holds real employee data and is not committed (the repo is public): build it
// from the HR export ("STOPLINE REPORT - DB_USER.xlsx") in the format of rqc-users.example.json.
//
// Users whose NIK is already in the database are left exactly as they are, so running it
// again never resets a password someone has changed or a role an admin has set.
//
//   npm run db:seed:rqc-users          add the missing users
//   npm run db:seed:rqc-users:check    only report what would be added (no writes)

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

type SeedUser = { nik: string; namaUser: string };

// npm runs this from packages/database, where Prisma doesn't find the repo-root .env.
// Variables already in the environment (Docker passes its own) are not overwritten.
const rootEnv = join(__dirname, '..', '..', '..', '.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const DATA_FILE = join(__dirname, 'data', 'rqc-users.json');

const prisma = new PrismaClient();

function loadUsers(): SeedUser[] {
  if (!existsSync(DATA_FILE)) {
    throw new Error(`${DATA_FILE} not found. Create it in the format of data/rqc-users.example.json.`);
  }
  const users: SeedUser[] = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  const seen = new Set<string>();
  for (const u of users) {
    // Same limits as the master_user columns: nik VarChar(30), nama_user VarChar(150)
    if (typeof u.nik !== 'string' || !/^\S{1,30}$/.test(u.nik)) throw new Error(`Invalid NIK: ${JSON.stringify(u)}`);
    if (typeof u.namaUser !== 'string' || !u.namaUser.trim() || u.namaUser.length > 150) {
      throw new Error(`Invalid name for NIK ${u.nik}: ${JSON.stringify(u.namaUser)}`);
    }
    if (seen.has(u.nik)) throw new Error(`NIK ${u.nik} is listed twice in rqc-users.json`);
    seen.add(u.nik);
  }
  return users;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const password = process.env.SEED_RQC_PASSWORD ?? '';
  const users = loadUsers();

  const existing = await prisma.masterUser.findMany({
    where: { nik: { in: users.map(u => u.nik) } },
    select: { nik: true, namaUser: true, role: true },
  });
  const existingNiks = new Set(existing.map(u => u.nik));
  const toAdd = users.filter(u => !existingNiks.has(u.nik));

  console.log(`🌱 RQC users in rqc-users.json: ${users.length}`);
  console.log(`   already in the database, left unchanged: ${existing.length}`);
  // Names only when a few are skipped; on a rerun all of them are, and the list is just noise
  if (existing.length <= 20) for (const u of existing) console.log(`     - ${u.nik} ${u.namaUser} (${u.role})`);
  console.log(`   to add: ${toAdd.length}`);
  console.log(`   SEED_RQC_PASSWORD: ${password ? 'set' : 'NOT SET'}`);

  if (dryRun) {
    console.log('Dry run: nothing written.');
    return;
  }
  if (toAdd.length === 0) return;
  if (!password) {
    throw new Error("SEED_RQC_PASSWORD is not set. Add SEED_RQC_PASSWORD='...' to the repo-root .env (single quotes keep $ and % as typed).");
  }

  const data = [];
  for (const u of toAdd) {
    // One hash per user, so each one gets its own salt
    data.push({ nik: u.nik, namaUser: u.namaUser.trim(), passwordHash: await argon2.hash(password), role: 'RQC', isActive: true });
  }
  // One statement: either all of them are added or none. skipDuplicates covers a user
  // created in the app between the check above and this insert.
  const { count } = await prisma.masterUser.createMany({ data, skipDuplicates: true });
  console.log(`✅ Added ${count} RQC users (passwords hashed with Argon2id)`);
}

main()
  .catch(e => {
    console.error('❌ RQC user seed failed:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
