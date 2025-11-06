import { Module } from '@nestjs/common';
import { ExamMaterialsController } from './exam-materials.controller';
import { ExamMaterialsService } from './exam-materials.service';
import { StudentsModule } from '../students/students.module';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [StudentsModule, AdminModule, AuthModule],
  controllers: [ExamMaterialsController],
  providers: [ExamMaterialsService],
})
export class ExamMaterialsModule {}

