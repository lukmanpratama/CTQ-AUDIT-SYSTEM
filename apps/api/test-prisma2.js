const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://ctqaudit:ctqaudit_pass@localhost:5433/ctqaudit_db?schema=public'
        }
    }
});

async function main() {
    console.log('Connecting to Prisma...');
    await prisma.$connect();
    console.log('Connected to Prisma successfully!');
    const count = await prisma.$queryRawUnsafe('SELECT 1 as val');
    console.log('Result:', count);
}

main()
    .catch(e => {
        console.error('Error in Prisma test:', e);
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log('Disconnected');
    });
