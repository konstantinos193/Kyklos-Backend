import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const admin = request['admin'];

    if (
      admin &&
      (admin.role === 'admin' || admin.role === 'super_admin' || admin.role === 'moderator')
    ) {
      return true;
    }

    throw new ForbiddenException('Access denied. Admin privileges required.');
  }
}

