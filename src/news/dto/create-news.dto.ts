import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsArray, IsDate, MaxLength, IsEnum } from 'class-validator';

export enum NewsType {
  ANNOUNCEMENT = 'announcement',
  EVENT = 'event',
  SEMINAR = 'seminar',
}

export class CreateNewsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  excerpt: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(NewsType)
  @IsNotEmpty()
  type: NewsType;

  @IsObject()
  @IsNotEmpty()
  author: {
    name: string;
    image?: string;
  };

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsObject()
  @IsNotEmpty()
  image: {
    url: string;
    alt?: string;
    caption?: string;
  };

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsDate()
  publishDate?: Date;

  @IsOptional()
  @IsDate()
  eventDate?: Date;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  readTime?: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsObject()
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
  };
}

