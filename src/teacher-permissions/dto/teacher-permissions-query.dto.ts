import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class TeacherPermissionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  teacherId?: string;

  @IsOptional()
  @IsString()
  examMaterialId?: string;

  @IsOptional()
  @IsString()
  action?: string;
}
