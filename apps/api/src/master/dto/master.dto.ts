import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateAreaDto { @IsString() @IsNotEmpty() area!: string; }
export class UpdateAreaDto { @IsString() @IsNotEmpty() area!: string; }

export class CreateProcessDto {
    @IsString() @IsNotEmpty() process!: string;
    @IsString() @IsOptional() ctq?: string;
    @IsString() @IsOptional() riskLevel?: string;
}
export class UpdateProcessDto {
    @IsString() @IsOptional() process?: string;
    @IsString() @IsOptional() ctq?: string;
    @IsString() @IsOptional() riskLevel?: string;
    @IsString() @IsOptional() sellingPoint?: string;
}

export class CreateDefectDto { @IsString() @IsNotEmpty() defect!: string; }
export class UpdateDefectDto { @IsString() @IsNotEmpty() defect!: string; }

export class CreateFactoryDto { @IsString() @IsNotEmpty() factory!: string; }

export class CreateUserDto {
    @IsString() @IsNotEmpty() nik!: string;
    @IsString() @IsNotEmpty() namaUser!: string;
    @IsString() @IsNotEmpty() password!: string;
    @IsString() @IsOptional() role?: string;
}
export class UpdateUserDto {
    @IsString() @IsNotEmpty() namaUser!: string;
    @IsString() @IsOptional() password?: string;
    @IsString() @IsNotEmpty() role!: string;
    @IsBoolean() @IsNotEmpty() isActive!: boolean;
}

export class CreatePoDto {
    @IsString() @IsNotEmpty() po!: string;
    @IsString() @IsNotEmpty() article!: string;
    @IsString() @IsNotEmpty() model!: string;
    @IsString() @IsOptional() destination?: string;
    @IsNumber() @IsNotEmpty() qtyOrder!: number;
}
export class UpdatePoDto {
    @IsString() @IsOptional() article?: string;
    @IsString() @IsOptional() model?: string;
    @IsString() @IsOptional() destination?: string;
    @IsNumber() @IsOptional() qtyOrder?: number;
}

export class CreateUspDto {
    @IsString() @IsNotEmpty() setupModelId!: string;
    @IsString() @IsNotEmpty() uspCode!: string;
    @IsString() @IsNotEmpty() uspName!: string;
    @IsString() @IsOptional() description?: string;
    @IsBoolean() @IsNotEmpty() isActive!: boolean;
}
export class UpdateUspDto {
    @IsString() @IsOptional() setupModelId?: string;
    @IsString() @IsOptional() uspCode?: string;
    @IsString() @IsOptional() uspName?: string;
    @IsString() @IsOptional() description?: string;
    @IsBoolean() @IsOptional() isActive?: boolean;
}
