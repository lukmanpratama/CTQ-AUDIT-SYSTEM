import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const setupDefects = await prisma.setupDefectTqc.findMany();
    const tqcReports = await prisma.tqcReport.findMany({
        where: { moduleType: 'ASSEMBLY' },
        take: 10
    });

    console.log("Setup Defects:");
    setupDefects.forEach(sd => {
        console.log(`- '${sd.defectName}' -> '${sd.ctqType}'`);
    });

    console.log("\nSample TQC Reports:");
    tqcReports.forEach(tr => {
        console.log(`- '${tr.defectName}'`);
    });
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
