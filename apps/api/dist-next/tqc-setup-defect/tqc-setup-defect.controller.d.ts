import { TqcSetupDefectService } from './tqc-setup-defect.service';
import { CreateSetupDefectTqcDto, UpdateSetupDefectTqcDto } from './tqc-setup-defect.dto';
export declare class TqcSetupDefectController {
    private readonly tqcSetupDefectService;
    constructor(tqcSetupDefectService: TqcSetupDefectService);
    findAll(): Promise<{
        createdAt: Date;
        defectName: string;
        ctqType: string;
        setupDefectTqcId: number;
    }[]>;
    create(createDto: CreateSetupDefectTqcDto): Promise<{
        createdAt: Date;
        defectName: string;
        ctqType: string;
        setupDefectTqcId: number;
    }>;
    bulkCreate(createDtos: CreateSetupDefectTqcDto[]): Promise<{
        createdAt: Date;
        defectName: string;
        ctqType: string;
        setupDefectTqcId: number;
    }[]>;
    update(id: number, updateDto: UpdateSetupDefectTqcDto): Promise<{
        createdAt: Date;
        defectName: string;
        ctqType: string;
        setupDefectTqcId: number;
    }>;
    clearAll(): Promise<import(".prisma/client").Prisma.BatchPayload>;
    remove(id: number): Promise<{
        createdAt: Date;
        defectName: string;
        ctqType: string;
        setupDefectTqcId: number;
    }>;
}
//# sourceMappingURL=tqc-setup-defect.controller.d.ts.map