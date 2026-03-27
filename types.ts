export enum UserRole {
  WaterManager = 'Water Manager',
  WaterOffice = 'Water Office',
  DistrictOffice = 'District Office',
  DitchRider = 'Ditch Rider',
  Farmer = 'farmer', // Added fallback role used by the backend signup
}

export interface User {
  id: number | string; // Updated to allow the 'USR-XXXX' string IDs from Postgres
  name: string;
  role: UserRole;
  email: string;
  city?: string; // Added for the new Profile page
  phone?: string; // Added for the new Profile page
  assignedLaterals?: string[];
}

export enum WaterOrderStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  InProgress = 'In Progress',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
  AwaitingApproval = 'Awaiting Approval',
}

export enum WaterOrderType {
  TurnOn = 'Turn On-Delivery',
  TurnOff = 'Turn Off',
  Update = 'Update-Delivery',
}

export interface Lateral {
  id: string;
  name: string;
}

export interface Headgate {
  id: string;
  name: string;
  lateralId: string;
  lateral?: string;
  lateral_name?: string;
  tapNumber: string;
}

export interface Account {
  id: number;
  accountNumber: string;
  ownerName?: string;
  headgateId?: string; 
  allocationForField?: number;
  usageForField?: number;
  isActive?: boolean;
  isQueued?: boolean;
}

export interface WaterAccount {
  accountNumber: string;
  ownerName: string;
  totalAllotment: number;
  balance?: number; // Calculated on frontend
}

export interface Field {
  id: string;
  name: string;
  companyName?: string;
  address?: string;
  phone?: string;
  crop: string;
  acres: number;
  location: string;
  lat?: number;
  lng?: number;
  totalWaterAllocation: number;
  waterUsed: number;
  waterAllotment?: number;
  allotmentUsed?: number;
  owner?: string; 
  headgateIds: string[]; 
  headgate_ids?: string[];
  headgates?: Headgate[];
  lateral?: string;
  tapNumber?: string;
  accounts: Account[];
  currentRunningInches?: number;
  primaryAccountNumber?: string;
}

export interface WaterOrder {
  id: string;
  fieldId: string;
  fieldName: string;
  requester: string;
  status: WaterOrderStatus;
  orderType: WaterOrderType;
  orderDate: string;
  deliveryStartDate: string;
  deliveryEndDate?: string;
  requestedAmount: number;
  requestedInches?: number;
  lateralId: string;
  lateral?: string;
  headgateId: string;
  tapNumber: string;
  ditchRiderId?: number;
  accountNumber?: string;
}

export interface WaterBankEntry {
  id: string;
  fieldAssociation?: string;
  amountAvailable: number;
  lateral: string;
}

export enum AlertType {
  Allotment = 'allotment',
  Allocation = 'allocation',
  Both = 'both'
}

export interface AccountAlert {
  id: string;
  accountNumber: string;
  alertType: AlertType;
  thresholdPercent: number;
  isAcknowledged: boolean;
}