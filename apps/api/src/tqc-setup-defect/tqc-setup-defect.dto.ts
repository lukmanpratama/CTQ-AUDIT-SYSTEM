import { IsString, IsNotEmpty } from 'class-validator';

export const CTQ_TYPES = [
    'External Compliance',
    'Safety',
    'Function',
    'Durability',
    'Appearance',
    'Color',
    'Fit&Comfort',
] as const;

export class CreateSetupDefectTqcDto {
    @IsString()
    @IsNotEmpty()
    defectName!: string;

    @IsString()
    @IsNotEmpty()
    ctqType!: string;
}

export class UpdateSetupDefectTqcDto {
    @IsString()
    @IsNotEmpty()
    defectName!: string;

    @IsString()
    @IsNotEmpty()
    ctqType!: string;
}
