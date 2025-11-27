import React, { useMemo, useState } from 'react';
import { User, WaterOrder, WaterOrderStatus, Field } from '../types';
import { QrCodeIcon, CheckCircleIcon, XCircleIcon } from '../components/icons';
import Scanner from '../components/Scanner';
import { createWaterOrder, updateWaterOrder } from '../services/api';

interface DitchRiderDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
  fields: Field[];
  refreshWaterOrders: () => Promise<void>;
}

const DitchRiderDashboard: React.FC<DitchRiderDashboardProps> = ({ user, waterOrders, fields, refreshWaterOrders }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'start' | 'stop'>('start');
  
  // Filter my orders
  const myOrders = waterOrders.filter(o => o.ditchRiderId === user.id);

  // Grouped for Tabs
  const startOrders = myOrders.filter(o => o.status === WaterOrderStatus.Approved);
  const stopOrders = myOrders.filter(o => o.status === WaterOrderStatus.InProgress);

  const currentList = activeTab === 'start' ? startOrders : stopOrders;

  const ordersByLateral = useMemo(() => {
    return currentList.reduce((acc, order) => {
      const lateral = order.lateral || 'Unassigned';
      if (!acc[lateral]) {
        acc[lateral] = [];
      }
      acc[lateral].push(order);
      return acc;
    }, {} as Record<string, WaterOrder[]>);
  }, [currentList]);
  
  const handleScan = async (data: string) => {
    setIsScanning(false);
    try {
      const { action, fieldId, fieldName } = JSON.parse(data);
      
      if (action === 'start-delivery') {
        // ... Logic for starting delivery
        const orderToStart = startOrders.find(o => o.fieldId === fieldId);
        
        if (orderToStart) {
             // If we have an approved order, update it
             await updateWaterOrder(orderToStart.id, { ...orderToStart, status: WaterOrderStatus.InProgress });
             await refreshWaterOrders();
             alert(`Delivery STARTED for ${fieldName}.`);
        } else {
            // Fallback: Create new if logic allows, or just alert
             alert(`No approved order found for ${fieldName} to start.`);
        }

      } else if (action === 'end-delivery') {
        const orderToEnd = stopOrders.find(o => o.fieldId === fieldId);

        if (orderToEnd) {
            await updateWaterOrder(orderToEnd.id, { ...orderToEnd, status: WaterOrderStatus.Completed });
            await refreshWaterOrders();
            alert(`Delivery ENDED for ${fieldName}. Alert sent to Water Manager.`);
        } else {
          alert(`No active delivery found for "${fieldName}" to stop.`);
        }
      } else {
        alert('Invalid QR code action.');
      }

    } catch (e) {
      alert('Error scanning QR code. Invalid data format.');
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Ditch Rider Control</h2>
            <p className="text-gray-600">Tasks for {user.name}</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow p-1 flex">
            <button 
                onClick={() => setActiveTab('start')}
                className={`flex-1 py-3 text-center rounded-md font-bold text-lg transition-colors ${activeTab === 'start' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                Turn ON ({startOrders.length})
            </button>
            <button 
                onClick={() => setActiveTab('stop')}
                className={`flex-1 py-3 text-center rounded-md font-bold text-lg transition-colors ${activeTab === 'stop' ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
                Turn OFF ({stopOrders.length})
            </button>
        </div>
      
      {Object.keys(ordersByLateral).length === 0 ? (
          <div className="text-center py-10 bg-white rounded-lg shadow-sm border border-gray-100">
            <p className="text-gray-500 text-lg">No tasks in this category.</p>
          </div>
      ) : (
          Object.keys(ordersByLateral).map((lateral) => (
            <div key={lateral} className="animate-fade-in">
            <h3 className="text-xl font-semibold text-gray-700 mb-3 px-2 border-b border-gray-200 pb-1">Lateral {lateral}</h3>
            <div className="space-y-4">
                {ordersByLateral[lateral].map(order => (
                    <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden border-l-4 border-gray-300">
                        <div className="p-5">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="text-xl font-bold text-gray-800">{order.fieldName}</h4>
                                    <p className="text-sm text-gray-500">Tap: {order.tapNumber || 'N/A'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-gray-900">{order.requestedAmount} AF</p>
                                    <p className="text-xs text-gray-500">Requested</p>
                                </div>
                            </div>
                            
                            <div className="mt-4">
                                <button 
                                    onClick={() => setIsScanning(true)}
                                    className={`w-full py-4 rounded-lg font-bold text-xl text-white shadow-sm flex items-center justify-center space-x-2 transition-transform active:scale-95 ${activeTab === 'start' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
                                >
                                    <QrCodeIcon className="h-6 w-6" />
                                    <span>{activeTab === 'start' ? 'SCAN TO TURN ON' : 'SCAN TO TURN OFF'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            </div>
        ))
      )}

      {isScanning && (
        <Scanner
          onScan={handleScan}
          onClose={() => setIsScanning(false)}
        />
      )}
    </div>
  );
};

export default DitchRiderDashboard;