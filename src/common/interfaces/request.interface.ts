import { Request } from 'express';

export interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export interface StudentRequest extends Request {
  student?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    grade?: string;
    hasAccessToThemata?: boolean;
  };
  studentId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}
