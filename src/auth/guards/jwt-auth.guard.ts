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
      if (!process.env.JWT_SECRET) {
        console.error('JWT secret is not configured. Set JWT_SECRET in environment.');
        throw new UnauthorizedException('Server configuration error: JWT not configured');
      }

      const payload = await this.jwtService.verifyAsync(token);

      request['admin'] = payload;
      return true;
    } catch (error: any) {
      console.error('Token verification error:', error.message);
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

