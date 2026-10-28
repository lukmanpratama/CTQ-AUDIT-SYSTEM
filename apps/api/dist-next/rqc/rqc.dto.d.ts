export declare class CreateHeaderDto {
    date: string;
    checkingTime: string;
    setupModelId: string;
    po: string;
    factoryId: string;
    nik: string;
    cell?: string;
    rqcHeaderId?: string;
}
export declare class UpdateHeaderDto {
    date: string;
    checkingTime: string;
    po: string;
    factoryId: string;
    cell?: string;
}
export interface RqcImportRow {
    rowNo: number;
    date: string;
    checkingTime: string;
    nik: string;
    model: string;
    po: string;
    factory: string;
    cell?: string;
    process: string;
    qtyCheck: number;
    defectName?: string;
    qtyDefect?: number;
    actionPlan?: string;
    rootCause?: string;
    corrective?: string;
    durasiStopline?: number;
    photoDefect?: string;
    photoImprovement?: string;
}
export declare class ImportInspectionsDto {
    rows: RqcImportRow[];
    apply?: boolean;
}
export declare class DefectInputDto {
    defectId: string;
    qtyDefect: number;
    actionPlan?: string;
    rootCause?: string;
    corrective?: string;
    durasiStopline?: number;
    photoDefect?: string;
    photoAfterActionPlan?: string;
}
export declare class CreateInspectionDto {
    qtyChecking: number;
    defects: DefectInputDto[];
}
//# sourceMappingURL=rqc.dto.d.ts.map