import React, { useMemo } from 'react';
import { User, WaterOrder, WaterOrderStatus } from '../types';
import { WATER_ORDERS } from '../constants';
import { QrCodeIcon } from '../components/icons';

interface DitchRiderDashboardProps {
  user: User;
}

const DitchRiderDashboard: React.FC<DitchRiderDashboardProps> = ({ user }) => {
  
  const myOrders = WATER_ORDERS.filter(o => o.ditchRiderId === user.id && (o.status === WaterOrderStatus.Approved || o.status === WaterOrderStatus.InProgress));

  const ordersByLateral = useMemo(() => {
    return myOrders.reduce((acc, order) => {
      const lateral = order.lateral || 'Unassigned';
      if (!acc[lateral]) {
        acc[lateral] = [];
      }
      acc[lateral].push(order);
      return acc;
    }, {} as Record<string, WaterOrder[]>);
  }, [myOrders]);
  
  const OrderCard: React.FC<{order: WaterOrder}> = ({ order }) => (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex justify-between items-start">
            <div>
                <p className="font-bold text-gray-800">{order.fieldName}</p>
                <p className="text-sm text-gray-500">Order ID: {order.id}</p>
            </div>
            {order.status === WaterOrderStatus.InProgress && 
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 animate-pulse">In Progress</span>
            }
        </div>
        <p className="text-gray-700">Requested Amount: <span className="font-semibold">{order.requestedAmount} AF</span></p>
        
        {order.status === WaterOrderStatus.Approved && (
            <button className="w-full px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                Start Delivery
            </button>
        )}
        {order.status === WaterOrderStatus.InProgress && (
             <button className="w-full px-4 py-2 bg-red-600 text-white font-semibold rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                End Delivery
            </button>
        )}
    </div>
  );


  return (
    <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Ditch Rider Tasks</h2>
            <p className="text-gray-600">Welcome, {user.name}</p>
        </div>
      
      {/* Fix: Use Object.keys to iterate and access orders to ensure correct typing and avoid the '.map' of unknown error. */}
      {Object.keys(ordersByLateral).map((lateral) => (
        <div key={lateral}>
          <h3 className="text-xl font-semibold text-gray-700 mb-2 px-1">Lateral {lateral}</h3>
          <div className="space-y-4">
            {ordersByLateral[lateral].map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        </div>
      ))}

      {myOrders.length === 0 && (
        <div className="text-center py-10 bg-white rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-800">No active orders assigned.</h3>
            <p className="text-gray-500">Check back later for new tasks.</p>
        </div>
      )}

      {/* Sticky QR Code Button */}
      <div className="fixed bottom-6 right-6">
        <button className="flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-transform hover:scale-110">
          <QrCodeIcon className="h-8 w-8" />
          <span className="sr-only">Scan QR Code</span>
        </button>
      </div>
    </div>
  );
};

export default DitchRiderDashboard;