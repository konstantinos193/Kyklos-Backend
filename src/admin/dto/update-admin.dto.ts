import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { CreateAdminDto } from './create-admin.dto';

export class UpdateAdminDto extends PartialType(CreateAdminDto) {
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  specialization?: string;
}
