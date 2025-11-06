import { PartialType } from '@nestjs/mapped-types';
import { CreateTeacherPermissionDto } from './create-teacher-permission.dto';
import { IsOptional, IsBoolean, IsString, MaxLength } from 'class-validator';

export class UpdateTeacherPermissionDto extends PartialType(CreateTeacherPermissionDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

