
import { User, UserRole, Field, WaterOrder, WaterOrderStatus } from './types';

export const USERS: User[] = [
  { id: 1, name: 'Mike Beus', role: UserRole.WaterManager },
  { id: 2, name: 'Central Office', role: UserRole.WaterOffice },
  { id: 3, name: 'District Admin', role: UserRole.DistrictOffice },
  { id: 4, name: 'John Smith', role: UserRole.DitchRider },
  { id: 5, name: 'Jane Doe', role: UserRole.DitchRider },
];

export const FIELDS: Field[] = [
  { id: 'F001', name: 'North Field 1', crop: 'Alfalfa', acres: 120, location: '43.6150° N, 116.2023° W', totalWaterAllocation: 480, waterUsed: 150 },
  { id: 'F002', name: 'West Plot 3', crop: 'Corn', acres: 80, location: '43.6155° N, 116.2045° W', totalWaterAllocation: 350, waterUsed: 200 },
  { id: 'F003', name: 'South East 7', crop: 'Sugar Beets', acres: 150, location: '43.6140° N, 116.2010° W', totalWaterAllocation: 600, waterUsed: 450 },
  { id: 'F004', name: 'Riverbend 2', crop: 'Wheat', acres: 200, location: '43.6180° N, 116.2123° W', totalWaterAllocation: 700, waterUsed: 300 },
];

export const WATER_ORDERS: WaterOrder[] = [
  { id: 'WO-001', fieldId: 'F001', fieldName: 'North Field 1', requester: 'Mike Beus', status: WaterOrderStatus.Approved, orderDate: '2024-07-28', requestedAmount: 50, ditchRiderId: 4, lateral: 'A' },
  { id: 'WO-002', fieldId: 'F002', fieldName: 'West Plot 3', requester: 'Mike Beus', status: WaterOrderStatus.InProgress, orderDate: '2024-07-29', requestedAmount: 40, ditchRiderId: 4, lateral: 'A' },
  { id: 'WO-003', fieldId: 'F003', fieldName: 'South East 7', requester: 'Mike Beus', status: WaterOrderStatus.Pending, orderDate: '2024-07-30', requestedAmount: 60, lateral: 'B' },
  { id: 'WO-004', fieldId: 'F004', fieldName: 'Riverbend 2', requester: 'Mike Beus', status: WaterOrderStatus.Completed, orderDate: '2024-07-27', requestedAmount: 70, ditchRiderId: 5, lateral: 'B' },
  { id: 'WO-005', fieldId: 'F001', fieldName: 'North Field 1', requester: 'Mike Beus', status: WaterOrderStatus.Approved, orderDate: '2024-07-30', requestedAmount: 55, ditchRiderId: 5, lateral: 'C' },
  { id: 'WO-006', fieldId: 'F002', fieldName: 'West Plot 3', requester: 'Mike Beus', status: WaterOrderStatus.Cancelled, orderDate: '2024-07-26', requestedAmount: 30, ditchRiderId: 4, lateral: 'A' },
];

export const DATERANGE = [
    { name: 'Last 7 Days' },
    { name: 'Last 30 Days' },
    { name: 'This Month' },
    { name: 'Last Month' },
    { name: 'This Season' },
    { name: 'Last Season' }
]

export const REPORT_DATA = [
    { lateral: 'A', waterUsed: 4000, orders: 120 },
    { lateral: 'B', waterUsed: 3000, orders: 98 },
    { lateral: 'C', waterUsed: 5200, orders: 150 },
    { lateral: 'D', waterUsed: 2500, orders: 75 },
]
