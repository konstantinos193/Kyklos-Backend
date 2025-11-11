import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminStudentsController } from './admin-students.controller';
import { AdminStatsController } from './admin-stats.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminTeachersController } from './admin-teachers.controller';
import { AdminManagementController } from './admin-management.controller';
import { AdminService } from './admin.service';
import { AdminSettingsService } from './admin-settings.service';
import { StudentsModule } from '../students/students.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    StudentsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || process.env.JWT_SECRET,
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
  ],
  controllers: [
    AdminAuthController,
    AdminStudentsController,
    AdminStatsController,
    AdminSettingsController,
    AdminTeachersController,
    AdminManagementController,
  ],
  providers: [AdminService, AdminSettingsService],
  exports: [AdminService],
})
export class AdminModule {}

