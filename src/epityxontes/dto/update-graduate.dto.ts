import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateGraduateDto } from './create-graduate.dto';

/**
 * Κάθε πεδίο προαιρετικό: η σελίδα διαχείρισης στέλνει μόνο ό,τι άλλαξε,
 * ώστε δύο ταυτόχρονες διορθώσεις σε διαφορετικές στήλες να μην πατάει
 * η μία την άλλη.
 */
export class UpdateGraduateDto extends PartialType(CreateGraduateDto) {
  /** Απόκρυψη από το public site χωρίς διαγραφή. */
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
