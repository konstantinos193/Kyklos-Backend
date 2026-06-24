import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Access denied. No token provided.');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);

      request['admin'] = payload;
      return true;
    } catch (error: any) {
      throw new UnauthorizedException('Invalid token.');
    }
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    const cookies = request.cookies;
    if (cookies && cookies['adminToken']) {
      return cookies['adminToken'];
    }

    return undefined;
  }
}

