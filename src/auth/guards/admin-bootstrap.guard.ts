import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { AdminService } from '../../admin/admin.service';
import { AdminGuard } from './admin.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Protects admin creation.
 *
 * A brand new deployment has no admin to authenticate as, so the very first account
 * may be created unauthenticated. From the moment one admin exists, creating another
 * requires an authenticated admin - otherwise the endpoint lets anyone on the internet
 * mint themselves a super_admin.
 */
@Injectable()
export class AdminBootstrapGuard implements CanActivate {
  private readonly logger = new Logger(AdminBootstrapGuard.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly adminGuard: AdminGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const existingAdmins = await this.adminService.count({});

    if (existingAdmins === 0) {
      this.logger.warn(
        'No admin account exists yet - allowing unauthenticated creation of the first admin.',
      );
      return true;
    }

    await this.jwtAuthGuard.canActivate(context);
    return this.adminGuard.canActivate(context);
  }
}
