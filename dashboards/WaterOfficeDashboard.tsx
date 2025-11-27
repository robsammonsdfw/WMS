
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { WaterOrder, WaterOrderStatus } from '../types';
import WaterOrderList from '../components/WaterOrderList';
import DashboardCard from '../components/DashboardCard';
import { ClockIcon, CheckCircleIcon, RefreshIcon, WaterDropIcon, DocumentReportIcon, UserGroupIcon } from '../components/icons';
import { updateWaterOrder } from '../services/api';
import { DATERANGE, REPORT_DATA } from '../constants';

interface WaterOfficeDashboardProps {
  waterOrders: WaterOrder[];
  refreshWaterOrders: () => Promise<void>;
}

const WaterOfficeDashboard: React.FC<WaterOfficeDashboardProps> = ({ waterOrders, refreshWaterOrders }) => {
  // Order Management Data
  const pendingOrders = waterOrders.filter(o => o.status === WaterOrderStatus.Pending);
  const approvedOrders = waterOrders.filter(o => o.status === WaterOrderStatus.Approved);
  const inProgressOrders = waterOrders.filter(o => o.status === WaterOrderStatus.InProgress);
  
  // Analytics Data
  const totalWaterUsed = REPORT_DATA.reduce((sum, item) => sum + item.waterUsed, 0);
  const totalOrders = waterOrders.length;
  const activeDitchRiders = new Set(waterOrders.map(o => o.ditchRiderId).filter(id => id)).size;

  const handleUpdateStatus = async (orderId: string, status: WaterOrderStatus) => {
    const order = waterOrders.find(o => o.id === orderId);
    if (!order) return;

    try {
        await updateWaterOrder(orderId, { ...order, status });
        await refreshWaterOrders();
        const action = status === WaterOrderStatus.InProgress ? 'approved and is now in progress' : 'rejected';
        alert(`Order ${orderId} has been ${action}.`);
    } catch (error) {
        alert(`Failed to update order ${orderId}: ${error}`);
    }
  };


  const orderActions = (order: WaterOrder) => {
    if (order.status === WaterOrderStatus.Pending) {
        return (
            <div className="flex space-x-2">
                <button onClick={() => handleUpdateStatus(order.id, WaterOrderStatus.InProgress)} className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600">Approve</button>
                <button onClick={() => handleUpdateStatus(order.id, WaterOrderStatus.Cancelled)} className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">Reject</button>
            </div>
        )
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Analytics Section */}
      <section className="space-y-6">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-800">Central Office Overview</h2>
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
      </section>

      <hr className="border-gray-200" />

      {/* Order Management Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-800">Order Management</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard
            title="Pending Orders"
            value={pendingOrders.length}
            icon={<ClockIcon className="h-6 w-6 text-yellow-600" />}
            color="bg-yellow-100"
            />
            <DashboardCard
            title="Approved (Ready for Rider)"
            value={approvedOrders.length}
            icon={<CheckCircleIcon className="h-6 w-6 text-blue-600" />}
            color="bg-blue-100"
            />
            <DashboardCard
            title="Deliveries In Progress"
            value={inProgressOrders.length}
            icon={<RefreshIcon className="h-6 w-6 text-green-600" />}
            color="bg-green-100"
            />
        </div>
        
        <WaterOrderList 
            orders={pendingOrders} 
            title="Pending Water Orders for Approval" 
            actions={orderActions} 
        />
        <WaterOrderList 
            orders={[...approvedOrders, ...inProgressOrders]} 
            title="Active Water Orders" 
        />
      </section>
    </div>
  );
};

export default WaterOfficeDashboard;