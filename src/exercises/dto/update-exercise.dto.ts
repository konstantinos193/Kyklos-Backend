import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsBoolean } from 'class-validator';
import { CreateExerciseDto } from './create-exercise.dto';

export class UpdateExerciseDto extends PartialType(CreateExerciseDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
