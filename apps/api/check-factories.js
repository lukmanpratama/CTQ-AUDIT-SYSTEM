const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
    try {
        const factories = await prisma.masterFactory.findMany();
        fs.writeFileSync('factories.json', JSON.stringify(factories, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
            , 2));
    } catch (e) {
        fs.writeFileSync('factories.json', e.toString());
    } finally {
        await prisma.$disconnect();
    }
}

main();
