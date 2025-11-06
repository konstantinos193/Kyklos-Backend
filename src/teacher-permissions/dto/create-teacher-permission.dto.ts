import { IsString, IsNotEmpty, IsMongoId, IsIn, IsOptional, IsISO8601, MaxLength } from 'class-validator';

export class CreateTeacherPermissionDto {
  @IsMongoId()
  @IsNotEmpty()
  teacherId: string;

  @IsMongoId()
  @IsNotEmpty()
  examMaterialId: string;

  @IsString()
  @IsIn(['view', 'download', 'manage', 'full'])
  permissionType: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

