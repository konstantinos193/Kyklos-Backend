import { IsString, IsOptional, MinLength } from 'class-validator';

export class StudentLoginDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Invalid student id' })
  studentId?: string;

  @IsOptional()
  @IsString()
  uniqueKey?: string;
}

