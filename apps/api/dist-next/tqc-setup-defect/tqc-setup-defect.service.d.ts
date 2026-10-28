import { PrismaService } from '../prisma/prisma.service';
import { CreateSetupDefectTqcDto, UpdateSetupDefectTqcDto } from './tqc-setup-defect.dto';
export declare class TqcSetupDefectService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        createdAt: Date;
        defectName: string;
        ctqType: string;
        setupDefectTqcId: number;
    }[]>;
    create(dto: CreateSetupDefectTqcDto): Promise<{
        createdAt: Date;
        defectName: string;
        ctqType: string;
        setupDefectTqcId: number;
    }>;
    update(id: number, dto: UpdateSetupDefectTqcDto): Promise<{
        createdAt: Date;
        defectName: string;
        ctqType: string;
        setupDefectTqcId: number;
    }>;
    remove(id: number): Promise<{
        createdAt: Date;
        defectName: string;
        ctqType: string;
        setupDefectTqcId: number;
    }>;
    bulkCreate(data: CreateSetupDefectTqcDto[]): Promise<{
        createdAt: Date;
        defectName: string;
        ctqType: string;
        setupDefectTqcId: number;
    }[]>;
    clearAll(): Promise<import(".prisma/client").Prisma.BatchPayload>;
}
//# sourceMappingURL=tqc-setup-defect.service.d.ts.map