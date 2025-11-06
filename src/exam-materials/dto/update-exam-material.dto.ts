import { PartialType } from '@nestjs/mapped-types';
import { CreateExamMaterialDto } from './create-exam-material.dto';
import { IsOptional, IsBoolean, IsString } from 'class-validator';

export class UpdateExamMaterialDto extends PartialType(CreateExamMaterialDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @IsOptional()
  @IsString()
  lockReason?: string;
}

