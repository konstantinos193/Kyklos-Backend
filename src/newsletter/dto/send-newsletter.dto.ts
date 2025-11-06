import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class SendNewsletterDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsUrl()
  featuredImage?: string;
}

