import { IsEmail, IsOptional, IsString, IsIn, MaxLength } from 'class-validator';

export class SubscribeNewsletterDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['website', 'admin', 'import'])
  source?: string;
}

