import { Module } from '@nestjs/common';
import { TeacherPermissionsController } from './teacher-permissions.controller';
import { TeacherPermissionsService } from './teacher-permissions.service';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AdminModule, AuthModule],
  controllers: [TeacherPermissionsController],
  providers: [TeacherPermissionsService],
})
export class TeacherPermissionsModule {}

