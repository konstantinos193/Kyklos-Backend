import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { StudentLoginDto } from './dto/student-login.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('student-login')
  @HttpCode(HttpStatus.OK)
  async studentLogin(@Body() loginDto: StudentLoginDto) {
    return this.authService.studentLogin(loginDto);
  }

  @Post('student-verify')
  @HttpCode(HttpStatus.OK)
  async verifyStudent(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    return this.authService.verifyStudentToken(token);
  }

  @Post('student-logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return {
      success: true,
      message: 'Logout successful',
    };
  }

  @Post('student-refresh')
  @HttpCode(HttpStatus.OK)
  async refreshStudent(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }
    return this.authService.refreshStudentToken(token);
  }
}

