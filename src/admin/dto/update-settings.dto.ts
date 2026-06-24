import { IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsObject()
  siteSettings?: any;

  @IsOptional()
  @IsObject()
  contactSettings?: any;

  @IsOptional()
  @IsObject()
  socialSettings?: any;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  maintenanceMessage?: string;
}
