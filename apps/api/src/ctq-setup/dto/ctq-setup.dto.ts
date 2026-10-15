import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsArray } from 'class-validator';

export class CreateModelDto {
    @IsString()
    @IsNotEmpty()
    modelName!: string;

    /** Optional; empty means no Model No */
    @IsString()
    @IsOptional()
    modelNo?: string;

    /** Articles of this Model No, e.g. ["LA0398", "LA0399"] */
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    articles?: string[];

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}

export class LinkAreaDto {
    @IsString()
    @IsNotEmpty()
    areaId!: string;
}

export class LinkProcessDto {
    @IsString()
    @IsNotEmpty()
    processId!: string;
}

export class LinkDefectDto {
    @IsString()
    @IsNotEmpty()
    defectId!: string;
}

export class UploadPictureDto {
    @IsString()
    @IsNotEmpty()
    pictureBase64!: string;
}

export class UploadAuditFileDto {
    @IsString()
    @IsNotEmpty()
    auditFileBase64!: string;
}

export class UpdateModelDto {
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    modelName?: string;

    /** An empty string clears the Model No */
    @IsString()
    @IsOptional()
    modelNo?: string;

    /** Replaces the model's whole article list when given */
    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    articles?: string[];
}

export class UpdateSetupProcessDto {
    @IsString()
    @IsOptional()
    uspId?: string | null;

    @IsBoolean()
    @IsOptional()
    isSellingPoint?: boolean;
}
