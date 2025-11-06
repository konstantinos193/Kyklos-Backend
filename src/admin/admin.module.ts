import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminAuthController } from './admin-auth.controller';
import { AdminStudentsController } from './admin-students.controller';
import { AdminStatsController } from './admin-stats.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminTeachersController } from './admin-teachers.controller';
import { AdminService } from './admin.service';
import { StudentsModule } from '../students/students.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    StudentsModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
    AuthModule,
  ],
  controllers: [
    AdminAuthController,
    AdminStudentsController,
    AdminStatsController,
    AdminSettingsController,
    AdminTeachersController,
  ],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

