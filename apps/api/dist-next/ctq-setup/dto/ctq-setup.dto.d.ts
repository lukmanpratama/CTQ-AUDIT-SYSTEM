export declare class CreateModelDto {
    modelName: string;
    modelNo?: string;
    articles?: string[];
    isActive?: boolean;
}
export declare class LinkAreaDto {
    areaId: string;
}
export declare class LinkProcessDto {
    processId: string;
}
export declare class LinkDefectDto {
    defectId: string;
}
export declare class UploadPictureDto {
    pictureBase64: string;
}
export declare class UploadAuditFileDto {
    auditFileBase64: string;
}
export declare class UpdateModelDto {
    modelName?: string;
    modelNo?: string;
    articles?: string[];
}
export declare class UpdateSetupProcessDto {
    uspId?: string | null;
    isSellingPoint?: boolean;
}
//# sourceMappingURL=ctq-setup.dto.d.ts.map