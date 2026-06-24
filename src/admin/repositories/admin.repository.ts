import { Injectable } from '@nestjs/common';
import { BaseRepository, PaginationOptions, PaginationResult } from '../../common/repositories/base.repository';
import { DatabaseService } from '../../database/database.service';

export interface Admin {
  _id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  isActive: boolean;
  permissions?: any;
  specialization?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

@Injectable()
export class AdminRepository extends BaseRepository<Admin> {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'admins');
  }

  async findByEmail(email: string): Promise<Admin | null> {
    return this.findOne({ email: email.toLowerCase() });
  }

  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const filter: any = { email: email.toLowerCase() };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return this.exists(filter);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.updateOne({ _id: id }, { lastLogin: new Date() });
  }

  async findAllActive(
    filter: Record<string, any> = {},
    options: PaginationOptions = {},
  ): Promise<PaginationResult<Admin>> {
    return this.find({ ...filter, isActive: true }, options);
  }

  async findAllWithoutPassword(
    filter: Record<string, any> = {},
    options: PaginationOptions = {},
  ): Promise<PaginationResult<Omit<Admin, 'password'>>> {
    const result = await this.find(filter, options);
    return {
      ...result,
      data: result.data.map(admin => {
        const { password, ...adminWithoutPassword } = admin;
        return adminWithoutPassword;
      }),
    };
  }
}
