import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateTqcRecordDto } from './tqc.dto';
export declare class TqcService implements OnModuleInit {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    createMany(data: any[], moduleType: string): Promise<{
        count: number;
        skipped: number;
    }>;
    private static readonly TEXT_LIMITS;
    private validateRecords;
    getByModule(moduleType: string): Promise<{
        ctqTypeSetup: string | null;
        ctqType: any;
        tqcId: any;
        date: any;
        time: any;
        building: any;
        cell: any;
        model: any;
        article: any;
        orderNo: any;
        seq: any;
        pwiNo: any;
        qty: any;
        qtyDefect: any;
        qtyProduction: any;
        qtyChecking: any;
        destination: any;
        category: any;
        type: any;
        defectName: any;
        uspClassification: any;
        ctqTypeOverride: any;
        moduleType: any;
        createdAt: any;
    }[]>;
    updateUspClassification(id: number, uspClassification: string): Promise<{
        tqcId: number;
        uspClassification: string;
    }>;
    updateRecord(id: number, data: UpdateTqcRecordDto): Promise<{
        tqcId: number;
        updated: number;
        slotRows: number;
    }>;
    deleteRecord(id: number): Promise<{
        type: string | null;
        article: string | null;
        model: string | null;
        destination: string | null;
        createdAt: Date;
        qtyChecking: number | null;
        date: Date;
        qtyDefect: number | null;
        cell: string | null;
        tqcId: number;
        time: string | null;
        building: string | null;
        orderNo: string | null;
        seq: number | null;
        pwiNo: string | null;
        qty: number | null;
        qtyProduction: number | null;
        category: string | null;
        defectName: string | null;
        uspClassification: string | null;
        ctqType: string | null;
        moduleType: string;
    }>;
    deleteByModule(moduleType: string): Promise<import(".prisma/client").Prisma.BatchPayload>;
}
//# sourceMappingURL=tqc.service.d.ts.map