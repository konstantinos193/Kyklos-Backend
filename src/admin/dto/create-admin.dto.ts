import { IsString, IsEmail, IsNotEmpty, IsOptional, IsBoolean, IsEnum, MinLength } from 'class-validator';

export enum AdminRole {
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin',
  TEACHER = 'teacher',
}

export class CreateAdminDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AdminRole)
  @IsOptional()
  role?: AdminRole;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  permissions?: any;

  @IsString()
  @IsOptional()
  specialization?: string;
}
