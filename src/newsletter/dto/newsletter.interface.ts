export interface Newsletter {
  _id?: string;
  email: string;
  name?: string;
  isActive: boolean;
  subscribedAt: Date;
  source?: string;
  unsubscribedAt?: Date;
}
