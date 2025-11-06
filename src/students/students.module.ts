import { Module } from '@nestjs/common';
import { StudentService } from './students.service';

@Module({
  providers: [StudentService],
  exports: [StudentService],
})
export class StudentsModule {}

