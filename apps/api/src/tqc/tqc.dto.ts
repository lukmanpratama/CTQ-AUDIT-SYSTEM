import { IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

/** Row edit on the TQC Records page; only the fields sent are changed. */
export class UpdateTqcRecordDto {
    @IsString()
    @IsOptional()
    article?: string;

    /** null resets the hour slot to the standard 120 */
    @ValidateIf((_, v) => v !== null && v !== undefined)
    @IsNumber()
    @Min(0)
    qtyChecking?: number | null;

    @ValidateIf((_, v) => v !== null && v !== undefined)
    @IsNumber()
    @Min(0)
    qtyDefect?: number | null;

    /** '' or null follows the Setup Defect TQC mapping again */
    @ValidateIf((_, v) => v !== null && v !== undefined)
    @IsString()
    ctqType?: string | null;

    @IsString()
    @IsOptional()
    defectName?: string;
}
