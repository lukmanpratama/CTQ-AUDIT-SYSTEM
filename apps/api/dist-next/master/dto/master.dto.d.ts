export declare class CreateAreaDto {
    area: string;
}
export declare class UpdateAreaDto {
    area: string;
}
export declare class CreateProcessDto {
    process: string;
    ctq?: string;
    riskLevel?: string;
}
export declare class UpdateProcessDto {
    process?: string;
    ctq?: string;
    riskLevel?: string;
    sellingPoint?: string;
}
export declare class CreateDefectDto {
    defect: string;
}
export declare class UpdateDefectDto {
    defect: string;
}
export declare class CreateFactoryDto {
    factory: string;
}
export declare class CreateUserDto {
    nik: string;
    namaUser: string;
    password: string;
    role?: string;
}
export declare class UpdateUserDto {
    namaUser: string;
    password?: string;
    role: string;
    isActive: boolean;
}
export declare class CreatePoDto {
    po: string;
    article: string;
    model: string;
    destination?: string;
    qtyOrder: number;
}
export declare class UpdatePoDto {
    article?: string;
    model?: string;
    destination?: string;
    qtyOrder?: number;
}
export declare class CreateUspDto {
    setupModelId: string;
    uspCode: string;
    uspName: string;
    description?: string;
    isActive: boolean;
}
export declare class UpdateUspDto {
    setupModelId?: string;
    uspCode?: string;
    uspName?: string;
    description?: string;
    isActive?: boolean;
}
//# sourceMappingURL=master.dto.d.ts.map