import React, { useState } from 'react';
import { User, Field } from '../types';
import { FIELDS, WATER_ORDERS } from '../constants';
import DashboardCard from '../components/DashboardCard';
import WaterOrderList from '../components/WaterOrderList';
import { WaterDropIcon, DocumentReportIcon, ChartBarIcon, QrCodeIcon } from '../components/icons';
import QRCodeModal from '../components/QRCodeModal';

interface WaterManagerDashboardProps {
  user: User;
}

const WaterManagerDashboard: React.FC<WaterManagerDashboardProps> = ({ user }) => {
  const [selectedFieldForQR, setSelectedFieldForQR] = useState<Field | null>(null);

  const totalWaterUsed = FIELDS.reduce((sum, field) => sum + field.waterUsed, 0);
  const totalAllocation = FIELDS.reduce((sum, field) => sum + field.totalWaterAllocation, 0);
  const allocationUsedPercent = ((totalWaterUsed / totalAllocation) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Welcome, {user.name}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard
          title="Total Water Used (Season)"
          value={`${totalWaterUsed} AF`}
          icon={<WaterDropIcon className="h-6 w-6 text-blue-600" />}
          color="bg-blue-100"
        />
        <DashboardCard
          title="Total Allocation"
          value={`${totalAllocation} AF`}
          icon={<DocumentReportIcon className="h-6 w-6 text-green-600" />}
          color="bg-green-100"
        />
        <DashboardCard
          title="Allocation Used"
          value={`${allocationUsedPercent}%`}
          icon={<ChartBarIcon className="h-6 w-6 text-yellow-600" />}
          color="bg-yellow-100"
        />
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">My Fields</h3>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                + New Water Order
            </button>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Crop</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acres</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Water Used / Allocation (AF)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {FIELDS.map(field => {
                        const usagePercent = (field.waterUsed / field.totalWaterAllocation) * 100;
                        return (
                        <tr key={field.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{field.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{field.crop}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{field.acres}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{`${field.waterUsed} / ${field.totalWaterAllocation}`}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${usagePercent}%` }}></div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                                <button
                                    onClick={() => setSelectedFieldForQR(field)}
                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    title="Generate QR Codes"
                                >
                                    <QrCodeIcon className="h-5 w-5" />
                                    <span className="sr-only">Generate QR Codes for {field.name}</span>
                                </button>
                            </td>
                        </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
      </div>

      <WaterOrderList orders={WATER_ORDERS} title="My Recent Water Orders" />

      {selectedFieldForQR && (
        <QRCodeModal
          field={selectedFieldForQR}
          onClose={() => setSelectedFieldForQR(null)}
        />
      )}
    </div>
  );
};

export default WaterManagerDashboard;