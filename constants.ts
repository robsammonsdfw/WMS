
import { User, UserRole } from './types';

export const USERS: User[] = [
  { id: 1, name: 'Mike Beus', role: UserRole.WaterManager },
  { id: 2, name: 'Central Office', role: UserRole.WaterOffice },
  { id: 4, name: 'John Smith', role: UserRole.DitchRider, assignedLaterals: ['Lateral A', 'Lateral 8.13'] },
];

export const FIELDS: [] = []; // Data will be fetched from the database
export const WATER_ORDERS: [] = []; // Data will be fetched from the database

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
