import { IsString, IsNotEmpty, IsInt, IsOptional, ValidateNested, IsDecimal, Min, IsArray, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateHeaderDto {
    @IsString()
    @IsNotEmpty()
    date!: string; // Using ISO string for dates from client

    @IsString()
    @IsNotEmpty()
    checkingTime!: string;

    @IsString()
    @IsNotEmpty()
    setupModelId!: string; // Will cast to BigInt in service

    @IsString()
    @IsNotEmpty()
    po!: string;

    @IsString()
    @IsNotEmpty()
    factoryId!: string;

    @IsString()
    @IsNotEmpty()
    nik!: string;

    @IsString()
    @IsOptional()
    cell?: string;

    /** Set by the offline sync: the id the phone gave an audit started without a connection */
    @IsUUID()
    @IsOptional()
    rqcHeaderId?: string;
}

export class UpdateHeaderDto {
    @IsString()
    @IsNotEmpty()
    date!: string;

    @IsString()
    @IsNotEmpty()
    checkingTime!: string;

    @IsString()
    @IsNotEmpty()
    po!: string;

    @IsString()
    @IsNotEmpty()
    factoryId!: string;

    @IsString()
    @IsOptional()
    cell?: string;
}

/** One row of the RQC import template (one defect, or NO DEFECT, of one process in one audit). */
export interface RqcImportRow {
    rowNo: number;          // Excel row number, used in error messages
    date: string;           // yyyy-mm-dd
    checkingTime: string;   // Morning | Afternoon
    nik: string;
    model: string;          // CTQ setup model name
    po: string;
    factory: string;        // Factory 1-4 | INHOUSE | BOTTOM 1 | BOTTOM 2
    cell?: string;
    process: string;
    qtyCheck: number;
    defectName?: string;    // empty or NO DEFECT = process passed
    qtyDefect?: number;
    actionPlan?: string;
    rootCause?: string;
    corrective?: string;
    durasiStopline?: number;
    photoDefect?: string;
    photoImprovement?: string;
}

export class ImportInspectionsDto {
    @IsArray()
    rows!: RqcImportRow[];

    @IsBoolean()
    @IsOptional()
    apply?: boolean; // false/omitted = preview only
}

export class DefectInputDto {
    @IsString()
    @IsNotEmpty()
    defectId!: string;

    @IsInt()
    @Min(0)
    qtyDefect!: number;

    @IsString()
    @IsOptional()
    actionPlan?: string;

    @IsString()
    @IsOptional()
    rootCause?: string;

    @IsString()
    @IsOptional()
    corrective?: string;

    @IsInt()
    @IsOptional()
    durasiStopline?: number;

    @IsString()
    @IsOptional()
    photoDefect?: string;

    @IsString()
    @IsOptional()
    photoAfterActionPlan?: string;
}

export class CreateInspectionDto {
    @IsInt()
    @Min(1)
    qtyChecking!: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DefectInputDto)
    defects!: DefectInputDto[];
}
