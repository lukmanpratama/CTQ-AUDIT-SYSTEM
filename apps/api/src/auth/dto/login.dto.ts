// apps/api/src/auth/dto/login.dto.ts
import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'RQC001', description: 'NIK (User ID)' })
  @IsString()
  @IsNotEmpty()
  nik!: string;

  @ApiProperty({ example: 'Rqc@1234', description: 'Password' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}
