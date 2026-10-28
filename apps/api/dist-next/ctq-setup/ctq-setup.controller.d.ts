import { Response } from 'express';
import { CreateModelDto, LinkAreaDto, LinkProcessDto, LinkDefectDto, UploadPictureDto, UpdateModelDto, UploadAuditFileDto, UpdateSetupProcessDto } from './dto/ctq-setup.dto';
import { CtqSetupService } from './ctq-setup.service';
export declare class CtqSetupController {
    private readonly ctqSetupService;
    constructor(ctqSetupService: CtqSetupService);
    getModels(): Promise<any>;
    getModelTree(modelId: string): Promise<any>;
    getPicture(modelId: string, res: Response): Promise<void | Response<any, Record<string, any>>>;
    getAuditFile(modelId: string, res: Response): Promise<void | Response<any, Record<string, any>>>;
    private sendModelFile;
    validatePo(modelId: string, po: string): Promise<any>;
    createModel(body: CreateModelDto): Promise<any>;
    uploadPicture(modelId: string, body: UploadPictureDto): Promise<any>;
    uploadAuditFile(modelId: string, body: UploadAuditFileDto): Promise<any>;
    updateModel(modelId: string, body: UpdateModelDto): Promise<any>;
    linkArea(modelId: string, body: LinkAreaDto): Promise<any>;
    linkProcess(setupAreaId: string, body: LinkProcessDto): Promise<any>;
    updateProcess(setupProcessId: string, body: UpdateSetupProcessDto): Promise<any>;
    linkDefect(setupProcessId: string, body: LinkDefectDto): Promise<any>;
    removeArea(setupAreaId: string): Promise<{
        setupModelId: bigint;
        areaId: bigint;
        setupAreaId: bigint;
    }>;
    removeProcess(setupProcessId: string): Promise<{
        processId: bigint;
        uspId: bigint | null;
        isSellingPoint: boolean;
        setupAreaId: bigint;
        setupProcessId: bigint;
    }>;
    removeDefect(setupDefectId: string): Promise<{
        defectId: bigint;
        setupProcessId: bigint;
        setupDefectId: bigint;
    }>;
}
//# sourceMappingURL=ctq-setup.controller.d.ts.map