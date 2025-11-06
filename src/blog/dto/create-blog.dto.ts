import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsArray, IsDate, MaxLength } from 'class-validator';

export class CreateBlogDto {
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

  @IsObject()
  @IsNotEmpty()
  author: {
    name: string;
    image?: string;
  };

  @IsString()
  @IsNotEmpty()
  category: string;

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

