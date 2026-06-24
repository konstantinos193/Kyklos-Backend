import { IsString, IsOptional } from 'class-validator';

export class UploadArchiveFileDto {
  @IsString()
  @IsOptional()
  displayName?: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  year?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
