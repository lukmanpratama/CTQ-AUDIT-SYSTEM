import { PrismaService } from '../prisma/prisma.service';
import { RqcImportRow } from './rqc.dto';
export declare class RqcImportService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    importInspections(rows: RqcImportRow[], apply: boolean): Promise<{
        applied: boolean;
        summary: {
            rows: number;
            audits: number;
            auditsToCreate: number;
            auditsSkipped: number;
            processes: number;
            noDefectProcesses: number;
            defects: number;
            defectPcs: number;
            immediateActions: number;
            caps: number;
            models: string[];
            dateFrom: string;
            dateTo: string;
            factoriesToCreate: string[];
            setupDefectsToAdd: string[];
        };
        errors: {
            row: number;
            message: string;
        }[];
        errorsTruncated: boolean;
    }>;
    private normalizePo;
    private normalizeCheckingTime;
    private resolveFactoryName;
}
//# sourceMappingURL=rqc-import.service.d.ts.map