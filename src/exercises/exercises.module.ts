import { Module } from '@nestjs/common';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { StorageModule } from '../storage/storage.module';
import { AdminModule } from '../admin/admin.module';
import { StudentsModule } from '../students/students.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [StorageModule, AdminModule, StudentsModule, AuthModule],
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [ExercisesService],
})
export class ExercisesModule {}

