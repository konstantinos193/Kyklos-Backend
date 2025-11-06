import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { StudentService } from '../../students/students.service';

@Injectable()
export class StudentJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private studentService: StudentService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Απαιτείται αυθεντικοποίηση');
    }

    try {
      if (!process.env.JWT_SECRET) {
        throw new UnauthorizedException('Server configuration error: JWT not configured');
      }

      const payload = await this.jwtService.verifyAsync(token);

      if (payload.type !== 'student') {
        throw new UnauthorizedException('Μη έγκυρος τύπος token');
      }

      const student = await this.studentService.findById(payload.studentId);
      if (!student || student.status !== 'active') {
        throw new UnauthorizedException('Μη έγκυρος μαθητής');
      }

      request['student'] = student;
      request['studentId'] = student._id.toString();
      return true;
    } catch (error: any) {
      throw new UnauthorizedException('Μη έγκυρο token');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return undefined;
  }
}

