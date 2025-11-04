
import React from 'react';
import { User, WaterOrder, WaterOrderStatus } from '../types';
import WaterOrderList from '../components/WaterOrderList';
import DashboardCard from '../components/DashboardCard';
import { ClockIcon, CheckCircleIcon, RefreshIcon } from '../components/icons';

interface WaterOfficeDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
  setWaterOrders: React.Dispatch<React.SetStateAction<WaterOrder[]>>;
}

const WaterOfficeDashboard: React.FC<WaterOfficeDashboardProps> = ({ user, waterOrders, setWaterOrders }) => {
  const pendingOrders = waterOrders.filter(o => o.status === WaterOrderStatus.Pending);
  const approvedOrders = waterOrders.filter(o => o.status === WaterOrderStatus.Approved);
  const inProgressOrders = waterOrders.filter(o => o.status === WaterOrderStatus.InProgress);
  
  const handleApprove = (orderId: string) => {
    setWaterOrders(prev => prev.map(o => o.id === orderId ? {...o, status: WaterOrderStatus.InProgress} : o));
    alert(`Order ${orderId} approved and is now in progress.`);
  }

  const handleReject = (orderId: string) => {
    setWaterOrders(prev => prev.map(o => o.id === orderId ? {...o, status: WaterOrderStatus.Cancelled} : o));
     alert(`Order ${orderId} has been rejected.`);
  }

  const orderActions = (order: WaterOrder) => {
    if (order.status === WaterOrderStatus.Pending) {
        return (
            <div className="flex space-x-2">
                <button onClick={() => handleApprove(order.id)} className="px-3 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600">Approve</button>
                <button onClick={() => handleReject(order.id)} className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">Reject</button>
            </div>
        )
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Water Office Dashboard</h2>
      
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
    </div>
  );
};

export default WaterOfficeDashboard;