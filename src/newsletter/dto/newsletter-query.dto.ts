import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class NewsletterQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  source?: string;
}
