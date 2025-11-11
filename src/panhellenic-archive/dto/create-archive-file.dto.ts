import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber } from 'class-validator';

export enum ArchiveSubject {
  MATH = 'math',
  PHYSICS = 'physics',
  XIMIA = 'ximia',
  BIOLOGY = 'biology',
  GREEK_LITERATURE = 'greek-literature',
  ANCIENT_GREEK = 'ancient-greek',
  HISTORY = 'history',
  LATIN = 'latin',
  ECONOMICS = 'economics',
  INFORMATICS = 'informatics',
  ALGEBRA = 'algebra',
  GEOMETRY = 'geometry',
}

export class CreateArchiveFileDto {
  @IsString()
  @IsNotEmpty()
  displayName: string;

  @IsEnum(ArchiveSubject)
  @IsNotEmpty()
  subject: ArchiveSubject;

  @IsNumber()
  @IsNotEmpty()
  year: number;

  @IsString()
  @IsOptional()
  description?: string;
}

