import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsArray } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  school?: string;

  @IsArray()
  @IsOptional()
  subjects?: string[];

  @IsBoolean()
  @IsOptional()
  hasAccessToThemata?: boolean;
}
