const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const r = await prisma.rqcInspection.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
            rqcInspectionId: true,
            qtyDefect: true,
            photoDefect: true,
            photoAfterActionPlan: true,
            actionPlan: true
        }
    });
    console.log(JSON.stringify(r, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
