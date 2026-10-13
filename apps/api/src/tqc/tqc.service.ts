import { Injectable, HttpException, HttpStatus, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TqcService implements OnModuleInit {
    private readonly logger = new Logger(TqcService.name);

    constructor(private readonly prisma: PrismaService) { }

    async onModuleInit() {
        // Ensure new columns exist in the database without requiring prisma migrate/push
        try {
            await this.prisma.$executeRawUnsafe(
                `ALTER TABLE tqc_report ADD COLUMN IF NOT EXISTS usp_classification VARCHAR(100)`
            );
            this.logger.log('DB migration: usp_classification column ensured on tqc_report');
        } catch (e: any) {
            this.logger.warn('DB migration check skipped: ' + e.message);
        }
    }

    async createMany(data: any[], moduleType: string) {
        // Existing data is kept: imported rows are appended, and rows identical to an
        // existing record (or repeated within the same file) are skipped to avoid duplicates.

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
                uspClassification: String(row.uspClassification || ''),
                moduleType: moduleType.toUpperCase(),
            };
        });

        // Use raw SQL batch insert to bypass Prisma client type validation
        // This is required because the Prisma generated client may be stale after schema changes
        try {
            if (records.length === 0) return { count: 0, skipped: 0 };

            // Build a signature of every data column so duplicates can be detected
            const str = (v: any) => (v == null ? '' : String(v).trim());
            const num = (v: any) => (v == null || v === '' ? '' : String(Number(v)));
            const signature = (r: any) => [
                str(r.date), str(r.time), str(r.building), str(r.cell), str(r.model), str(r.article),
                str(r.orderNo), num(r.seq), str(r.pwiNo), num(r.qty), num(r.qtyDefect), num(r.qtyProduction),
                str(r.destination), str(r.category), str(r.type), str(r.defectName), str(r.uspClassification),
            ].join('|');

            const existingRows = await this.prisma.$queryRawUnsafe<any[]>(
                `SELECT to_char(date, 'YYYY-MM-DD') AS date, time, building, cell, model, article,
                        order_no AS "orderNo", seq, pwi_no AS "pwiNo", qty, qty_defect AS "qtyDefect",
                        qty_production AS "qtyProduction", destination, category, type,
                        defect_name AS "defectName", usp_classification AS "uspClassification"
                 FROM tqc_report WHERE module_type = $1`,
                moduleType.toUpperCase()
            );
            const seen = new Set<string>(existingRows.map(signature));

            const newRecords = records.filter((r: any) => {
                const key = signature({ ...r, date: r.date.toISOString().slice(0, 10) });
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            const skipped = records.length - newRecords.length;

            if (newRecords.length === 0) return { count: 0, skipped };

            const BATCH_SIZE = 100;
            let totalInserted = 0;

            for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
                const batch = newRecords.slice(i, i + BATCH_SIZE);
                const values = batch.map((r: any) => `(
                    ${r.date instanceof Date ? `'${r.date.toISOString()}'` : `'${new Date(r.date).toISOString()}'`},
                    ${r.time ? `'${String(r.time).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.building ? `'${String(r.building).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.cell ? `'${String(r.cell).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.model ? `'${String(r.model).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.article ? `'${String(r.article).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.orderNo ? `'${String(r.orderNo).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.seq != null ? Number(r.seq) : 'NULL'},
                    ${r.pwiNo ? `'${String(r.pwiNo).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.qty != null ? Number(r.qty) : 'NULL'},
                    ${r.qtyDefect != null ? Number(r.qtyDefect) : 'NULL'},
                    ${r.qtyProduction != null ? Number(r.qtyProduction) : 'NULL'},
                    ${r.destination ? `'${String(r.destination).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.category ? `'${String(r.category).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.type ? `'${String(r.type).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.defectName ? `'${String(r.defectName).replace(/'/g, "''")}'` : 'NULL'},
                    ${r.uspClassification != null ? `'${String(r.uspClassification).replace(/'/g, "''")}'` : 'NULL'},
                    '${String(r.moduleType).replace(/'/g, "''")}'
                )`).join(',');

                const sql = `INSERT INTO tqc_report (
                    date, time, building, cell, model, article, order_no, seq, pwi_no,
                    qty, qty_defect, qty_production, destination, category, type,
                    defect_name, usp_classification, module_type
                ) VALUES ${values}`;

                await this.prisma.$executeRawUnsafe(sql);
                totalInserted += batch.length;
            }

            return { count: totalInserted, skipped };
        } catch (error) {
            console.error("TQC UPLOAD DB ERROR:", error);
            throw new HttpException(`Failed to upload to DB: ${(error as any).message}`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async getByModule(moduleType: string) {
        // Use raw SQL to bypass Prisma Client's stale schema and fetch all columns including usp_classification
        const recordsRaw = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM tqc_report WHERE module_type = $1 ORDER BY date DESC, tqc_id DESC`,
            moduleType.toUpperCase()
        );

        // Map columns correctly, checking both snake_case (native SQL) and camelCase (Prisma parsed) returns
        // PostgreSQL returns all column names in lowercase (e.g. orderno, defectname) if they weren't quoted.
        const records = recordsRaw.map(r => {
            const getProp = (snake: string, camel: string, flat: string) =>
                r[snake] !== undefined ? r[snake] : (r[camel] !== undefined ? r[camel] : r[flat]);

            return {
                tqcId: getProp('tqc_id', 'tqcId', 'tqcid'),
                date: r.date,
                time: r.time,
                building: r.building,
                cell: r.cell,
                model: r.model,
                article: r.article,
                orderNo: getProp('order_no', 'orderNo', 'orderno'),
                seq: r.seq,
                pwiNo: getProp('pwi_no', 'pwiNo', 'pwino'),
                qty: r.qty,
                qtyDefect: getProp('qty_defect', 'qtyDefect', 'qtydefect'),
                qtyProduction: getProp('qty_production', 'qtyProduction', 'qtyproduction'),
                destination: r.destination,
                category: r.category,
                type: r.type,
                defectName: getProp('defect_name', 'defectName', 'defectname'),
                uspClassification: getProp('usp_classification', 'uspClassification', 'uspclassification'),
                moduleType: getProp('module_type', 'moduleType', 'moduletype'),
                createdAt: getProp('created_at', 'createdAt', 'createdat')
            };
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
