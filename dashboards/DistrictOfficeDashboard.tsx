import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// Fix: Pass `waterOrders` as a prop and use it to calculate `totalOrders` and `activeDitchRiders`. This resolves the TypeScript error by using a correctly typed array and ensures the dashboard uses dynamic data from the API instead of an empty constant.
import { User, WaterOrder } from '../types';
import { DATERANGE, REPORT_DATA } from '../constants';
import { WaterDropIcon, DocumentReportIcon, UserGroupIcon } from '../components/icons';
import DashboardCard from '../components/DashboardCard';

interface DistrictOfficeDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
}

const DistrictOfficeDashboard: React.FC<DistrictOfficeDashboardProps> = ({ user, waterOrders }) => {
  const totalWaterUsed = REPORT_DATA.reduce((sum, item) => sum + item.waterUsed, 0);
  const totalOrders = waterOrders.length;
  const activeDitchRiders = new Set(waterOrders.map(o => o.ditchRiderId).filter(id => id)).size;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">District Office Overview</h2>
        <div className="flex items-center space-x-2">
            <select className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                {DATERANGE.map(dr => <option key={dr.name}>{dr.name}</option>)}
            </select>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2">
                <DocumentReportIcon className="h-5 w-5" />
                <span>Generate Report</span>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard
          title="Total Water Delivered"
          value={`${(totalWaterUsed / 1000).toFixed(1)}K AF`}
          icon={<WaterDropIcon className="h-6 w-6 text-blue-600" />}
          color="bg-blue-100"
        />
        <DashboardCard
          title="Total Water Orders"
          value={totalOrders}
          icon={<DocumentReportIcon className="h-6 w-6 text-green-600" />}
          color="bg-green-100"
        />
        <DashboardCard
          title="Active Ditch Riders"
          value={activeDitchRiders}
          icon={<UserGroupIcon className="h-6 w-6 text-indigo-600" />}
          color="bg-indigo-100"
        />
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Water Usage by Lateral</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={REPORT_DATA}
              margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="lateral" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="waterUsed" fill="#3b82f6" name="Water Used (AF)" />
              <Bar dataKey="orders" fill="#86efac" name="Total Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DistrictOfficeDashboard;