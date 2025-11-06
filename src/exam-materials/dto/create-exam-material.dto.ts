import { IsString, IsNotEmpty, IsOptional, IsInt, IsIn, IsBoolean, IsObject, Min, Max } from 'class-validator';

export class CreateExamMaterialDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  grade: string;

  @IsInt()
  @Min(2000)
  @Max(2030)
  year: number;

  @IsString()
  @IsIn(['exam', 'solution', 'practice', 'theory', 'notes'])
  type: string;

  @IsOptional()
  @IsString()
  @IsIn(['basic', 'premium', 'vip'])
  accessLevel?: string;

  @IsString()
  @IsNotEmpty()
  filePath: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsInt()
  fileSize: number;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  @IsObject()
  metadata?: {
    difficulty?: string;
    duration?: number;
    questions?: number;
    points?: number;
  };
}

