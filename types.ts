
export enum UserRole {
  WaterManager = 'Water Manager',
  WaterOffice = 'Water Office',
  DistrictOffice = 'District Office',
  DitchRider = 'Ditch Rider',
}

export interface User {
  id: number;
  name: string;
  role: UserRole;
}

export enum WaterOrderStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export interface Field {
  id: string;
  name: string;
  crop: string;
  acres: number;
  location: string;
  totalWaterAllocation: number;
  waterUsed: number;
}

export interface WaterOrder {
  id: string;
  fieldId: string;
  fieldName: string;
  requester: string;
  status: WaterOrderStatus;
  orderDate: string;
  requestedAmount: number; // in acre-feet
  ditchRiderId?: number;
  lateral: string;
}
