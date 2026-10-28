import { PrismaService } from '../prisma/prisma.service';
export declare class CtqSetupService {
    private prisma;
    constructor(prisma: PrismaService);
    findAllModels(): Promise<any>;
    findSetupByModel(modelId: string): Promise<any>;
    private withFileUrls;
    getModelFile(modelId: string, kind: 'picture' | 'internalAuditFile'): Promise<{
        redirect: string;
        mime?: undefined;
        body?: undefined;
        fileName?: undefined;
    } | {
        mime: string;
        body: Buffer<ArrayBuffer>;
        fileName: string;
        redirect?: undefined;
    }>;
    validatePo(modelId: string, po: string): Promise<any>;
    createModel(data: {
        modelName: string;
        modelNo?: string;
        articles?: string[];
        isActive?: boolean;
    }): Promise<any>;
    updateModel(modelId: string, data: {
        modelName?: string;
        modelNo?: string;
        articles?: string[];
    }): Promise<any>;
    private assertModelNoFree;
    private assertArticlesFree;
    updateModelPicture(modelId: string, pictureBase64: string): Promise<any>;
    updateModelAuditFile(modelId: string, auditFileBase64: string): Promise<any>;
    linkAreaToModel(modelId: string, areaId: string): Promise<any>;
    linkProcessToArea(setupAreaId: string, processId: string): Promise<any>;
    linkDefectToProcess(setupProcessId: string, defectId: string): Promise<any>;
    updateSetupProcess(setupProcessId: string, data: {
        uspId?: string | null;
        isSellingPoint?: boolean;
    }): Promise<any>;
    removeSetupArea(setupAreaId: string): Promise<{
        setupModelId: bigint;
        areaId: bigint;
        setupAreaId: bigint;
    }>;
    removeSetupProcess(setupProcessId: string): Promise<{
        processId: bigint;
        uspId: bigint | null;
        isSellingPoint: boolean;
        setupAreaId: bigint;
        setupProcessId: bigint;
    }>;
    removeSetupDefect(setupDefectId: string): Promise<{
        defectId: bigint;
        setupProcessId: bigint;
        setupDefectId: bigint;
    }>;
    private serializeBigInt;
}
//# sourceMappingURL=ctq-setup.service.d.ts.map