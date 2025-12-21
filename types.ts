

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
  assignedLaterals?: string[]; // IDs of laterals this rider is responsible for
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

export interface Field {
  id: string;
  name: string;
  crop: string;
  acres: number;
  location: string;
  totalWaterAllocation: number;
  waterUsed: number;
  owner?: string; 
  headgateIds: string[]; 
  // Added missing properties referenced in components
  headgates?: Headgate[];
  lateral?: string;
  tapNumber?: string;
  accounts: Account[];
}

export interface WaterOrder {
  id: string;
  fieldId: string;
  fieldName: string;
  requester: string;
  status: WaterOrderStatus;
  orderType: WaterOrderType;
  orderDate: string; // Created date
  deliveryStartDate: string; // When the water should turn on/off
  requestedAmount: number; // in acre-feet
  requestedInches?: number; // Calculated from amount
  lateralId: string;
  // Added missing properties referenced in components
  lateral?: string;
  headgateId: string;
  tapNumber: string;
  ditchRiderId?: number;
}

// Added missing WaterBankEntry interface referenced in components/services
export interface WaterBankEntry {
  id: string;
  fieldAssociation?: string;
  amountAvailable: number;
  lateral: string;
}
