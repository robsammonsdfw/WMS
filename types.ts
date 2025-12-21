
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

export enum WaterOrderType {
  TurnOn = 'Turn On-Delivery',
  TurnOff = 'Turn Off',
  Update = 'Update-Delivery',
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
  headgateId?: number; 
  // Fields specific to the Field-Account relationship
  allocationForField?: number;
  usageForField?: number;
  isActive?: boolean; // Is this the currently billing account?
  isQueued?: boolean; // Is this the next account in line?
}

export interface WaterBankEntry {
  id: number;
  ownerName: string;
  lateral: string;
  amountAvailable: number;
  source: string;
  fieldAssociation?: string; // Optional name of a field this entry might be tied to
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
  
  // Relational Data
  headgates: Headgate[]; 
  accounts: Account[]; // List of all accounts linked to this field
  
  // Computed helpers (optional, but useful for UI)
  activeAccountId?: number;
  
  // Deprecated
  lateral?: string; 
  tapNumber?: string;
}

export interface WaterOrder {
  id: string;
  fieldId: string;
  fieldName: string;
  requester: string;
  status: WaterOrderStatus;
  orderType: WaterOrderType;
  orderDate: string;
  requestedAmount: number; // in acre-feet
  ditchRiderId?: number;
  lateral: string;
  serialNumber?: string;
  deliveryStartDate?: string;
  tapNumber?: string;
}
