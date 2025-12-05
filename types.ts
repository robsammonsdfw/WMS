
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
  AwaitingApproval = 'Awaiting Approval',
}

export interface Headgate {
  id: number;
  lateral: string;
  tapNumber: string;
}

export interface Account {
  id: number;
  accountNumber: string;
  ownerName?: string;
  headgateId?: number; // Optional link to a specific headgate
}

export interface Field {
  id: string;
  name: string;
  crop: string;
  acres: number;
  location: string;
  totalWaterAllocation: number;
  waterUsed: number;
  owner?: string; // Kept for backward compat, though Accounts might replace this
  
  // New Relational Data
  headgates: Headgate[]; 
  accounts: Account[];
  
  // Deprecated (kept optional for potential legacy API responses)
  lateral?: string; 
  tapNumber?: string;
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
  serialNumber?: string;
  deliveryStartDate?: string;
  tapNumber?: string;
}
