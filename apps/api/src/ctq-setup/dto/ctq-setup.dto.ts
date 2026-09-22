import { IsString, IsNotEmpty, IsBoolean, IsOptional } from 'class-validator';

export class CreateModelDto {
    @IsString()
    @IsNotEmpty()
    modelName!: string;

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

export class UpdateModelNameDto {
    @IsString()
    @IsNotEmpty()
    modelName!: string;
}
