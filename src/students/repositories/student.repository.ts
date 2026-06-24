import { Injectable } from '@nestjs/common';
import { BaseRepository, PaginationOptions, PaginationResult } from '../../common/repositories/base.repository';
import { DatabaseService } from '../../database/database.service';

export interface Student {
  _id: string;
  studentKey: string;
  email: string;
  firstName: string;
  lastName: string;
  grade?: string;
  school?: string;
  phone?: string;
  subjects?: string[];
  hasAccessToThemata?: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class StudentRepository extends BaseRepository<Student> {
  constructor(databaseService: DatabaseService) {
    super(databaseService, 'students');
  }

  async findByStudentKey(studentKey: string): Promise<Student | null> {
    return this.findOne({ studentKey });
  }

  async findByEmail(email: string): Promise<Student | null> {
    return this.findOne({ email: email.toLowerCase() });
  }

  async emailExists(email: string, excludeId?: string): Promise<boolean> {
    const filter: Record<string, any> = { email: email.toLowerCase() };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return this.exists(filter);
  }

  async studentKeyExists(studentKey: string, excludeId?: string): Promise<boolean> {
    const filter: Record<string, any> = { studentKey };
    if (excludeId) {
      filter._id = { $ne: excludeId };
    }
    return this.exists(filter);
  }

  async findByGrade(grade: string, options: PaginationOptions = {}): Promise<PaginationResult<Student>> {
    return this.find({ grade }, options);
  }

  async findBySchool(school: string, options: PaginationOptions = {}): Promise<PaginationResult<Student>> {
    return this.find({ school }, options);
  }

  async findAllActive(
    filter: Record<string, any> = {},
    options: PaginationOptions = {},
  ): Promise<PaginationResult<Student>> {
    return this.find({ ...filter, isActive: true }, options);
  }
}
