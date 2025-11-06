import { IsString, IsEmail, IsOptional, MinLength, MaxLength } from 'class-validator';

export class ContactFormDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(20)
  phone?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message: string;
}

