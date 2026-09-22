const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const existing = await prisma.masterFactory.findFirst({
            where: { factory: 'INHOUSE' }
        });

        if (!existing) {
            const created = await prisma.masterFactory.create({
                data: { factory: 'INHOUSE' }
            });
            console.log('Created INHOUSE factory with ID:', created.factoryId);
        } else {
            console.log('INHOUSE factory already exists with ID:', existing.factoryId);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
