import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from './guards/admin.guard';
import { StudentJwtGuard } from './guards/student-jwt.guard';
import { StudentsModule } from '../students/students.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
    StudentsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AdminGuard, StudentJwtGuard],
  exports: [AuthService, JwtAuthGuard, AdminGuard, StudentJwtGuard],
})
export class AuthModule {}

