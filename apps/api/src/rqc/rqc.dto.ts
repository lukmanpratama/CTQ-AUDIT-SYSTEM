import { IsString, IsNotEmpty, IsInt, IsOptional, ValidateNested, IsDecimal, Min, IsArray } from 'class-validator';
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
