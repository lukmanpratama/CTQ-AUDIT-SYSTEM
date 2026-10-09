const { PrismaClient } = require('./packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient();
prisma.masterUsp.findMany()
    .then(r => console.log('USPs in DB:', r))
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
