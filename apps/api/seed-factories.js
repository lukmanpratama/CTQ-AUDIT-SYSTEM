const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const existing = await prisma.masterFactory.findMany();
    console.log('Existing factories:', existing);

    const needed = ['Factory 1', 'Factory 2', 'Factory 3', 'Factory 4'];
    const existingNames = existing.map(f => f.factory.toLowerCase());

    for (const name of needed) {
        if (!existingNames.includes(name.toLowerCase())) {
            console.log(`Seeding: ${name}`);
            await prisma.masterFactory.create({
                data: { factory: name }
            });
        }
    }

    const final = await prisma.masterFactory.findMany();
    console.log('Final factories:', final);
}
main().catch(console.error).finally(() => prisma.$disconnect());
