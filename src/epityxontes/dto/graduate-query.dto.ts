import { Type } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EARLIEST_YEAR, LATEST_YEAR } from './create-graduate.dto';

export class GraduateQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(EARLIEST_YEAR)
  @Max(LATEST_YEAR)
  startYear?: number;

  /** Αναζήτηση σε επώνυμο, όνομα και σχολή. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** Μόνο για τη σελίδα διαχείρισης: `true` φέρνει και τους κρυμμένους. */
  @IsOptional()
  @IsBooleanString()
  includeHidden?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
