export interface Student {
  _id?: string;
  studentKey: string;
  uniqueKey?: string;
  email: string;
  firstName: string;
  lastName: string;
  grade?: string;
  school?: string;
  phone?: string;
  subjects?: string[];
  hasAccessToThemata?: boolean;
  isActive: boolean;
  lastLogin?: Date;
  registrationDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}
