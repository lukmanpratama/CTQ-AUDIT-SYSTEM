import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TqcService {
    constructor(private readonly prisma: PrismaService) { }

    async createMany(data: any[], moduleType: string) {
        // Delete existing data for this module to replace everything with the newly imported data
        await this.deleteByModule(moduleType);

        // We will receive an array of records parsed from the Excel file
        // Map them to the Prisma schema format
        const records = data.map((row: any) => {
            return {
                date: new Date(row.date), // Expecting YYYY-MM-DD or valid date string
                time: String(row.time || ''),
                building: String(row.building || ''),
                cell: String(row.cell || ''),
                model: String(row.model || ''),
                article: String(row.article || ''),
                orderNo: String(row.orderNo || ''),
                seq: row.seq ? Number(row.seq) : null,
                pwiNo: String(row.pwiNo || ''),
                qty: row.qty ? Number(row.qty) : null,
                qtyDefect: row.qtyDefect ? Number(row.qtyDefect) : null,
                qtyProduction: row.qtyProduction ? Number(row.qtyProduction) : null,
                destination: String(row.destination || ''),
                category: String(row.category || ''),
                type: String(row.type || ''),
                defectName: String(row.defectName || ''),
                moduleType: moduleType.toUpperCase(),
            };
        });

        // Use Prisma createMany to bulk insert
        const result = await this.prisma.tqcReport.createMany({
            data: records,
            skipDuplicates: true, // Prevents failure if there are exact DB-level dupes, though we don't have a unique constraint here right now
        });

        return { count: result.count };
    }

    async getByModule(moduleType: string) {
        const records = await this.prisma.tqcReport.findMany({
            where: { moduleType: moduleType.toUpperCase() },
            orderBy: { date: 'desc' }
        });

        const normalizeName = (name: string) => name ? name.replace(/\s+/g, ' ').trim().toLowerCase() : '';

        const mappingsList = await this.prisma.setupDefectTqc.findMany();
        const mappingDict = new Map<string, string>();
        for (const m of mappingsList) {
            mappingDict.set(normalizeName(m.defectName), m.ctqType);
        }

        return records.map(r => ({
            ...r,
            ctqType: r.defectName ? (mappingDict.get(normalizeName(r.defectName)) || null) : null
        }));
    }

    async deleteRecord(id: number) {
        return this.prisma.tqcReport.delete({
            where: { tqcId: id }
        });
    }

    async deleteByModule(moduleType: string) {
        return this.prisma.tqcReport.deleteMany({
            where: { moduleType: moduleType.toUpperCase() }
        });
    }
}
