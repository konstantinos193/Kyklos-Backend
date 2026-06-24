export interface TeacherPermission {
  _id?: string;
  teacher: string;
  teacherId?: string;
  examMaterial: string;
  examMaterialId?: string;
  action: string;
  permissionType?: string;
  isActive: boolean;
  expiresAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface TeacherPermissionFilter {
  teacherId?: string;
  examMaterialId?: string;
  action?: string;
  permissionType?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}
