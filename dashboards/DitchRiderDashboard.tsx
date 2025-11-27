
import React, { useMemo, useState } from 'react';
import { User, WaterOrder, WaterOrderStatus, Field } from '../types';
import { QrCodeIcon, TrashIcon } from '../components/icons';
import Scanner from '../components/Scanner';
import { updateWaterOrder } from '../services/api';

interface DitchRiderDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
  fields: Field[];
  refreshWaterOrders: () => Promise<void>;
}

const DitchRiderDashboard: React.FC<DitchRiderDashboardProps> = ({ user, waterOrders, fields, refreshWaterOrders }) => {
  const [activeTab, setActiveTab] = useState<'start' | 'stop'>('start');
  const [turnOnIds, setTurnOnIds] = useState<string[]>([]);
  const [turnOffIds, setTurnOffIds] = useState<string[]>([]);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanTargetOrder, setScanTargetOrder] = useState<WaterOrder | null>(null);

  // Filter orders eligible for actions
  const approvedOrders = useMemo(() => waterOrders.filter(o => o.status === WaterOrderStatus.Approved), [waterOrders]);
  const inProgressOrders = useMemo(() => waterOrders.filter(o => o.status === WaterOrderStatus.InProgress), [waterOrders]);

  // Determine which orders can be added to the current list (excluding ones already added)
  const availableOptions = useMemo(() => {
    if (activeTab === 'start') {
        return approvedOrders.filter(o => !turnOnIds.includes(o.id));
    } else {
        return inProgressOrders.filter(o => !turnOffIds.includes(o.id));
    }
  }, [activeTab, approvedOrders, inProgressOrders, turnOnIds, turnOffIds]);

  // Determine the current list of orders to display
  const currentListIds = activeTab === 'start' ? turnOnIds : turnOffIds;
  const currentListOrders = useMemo(() => {
      const sourceList = activeTab === 'start' ? approvedOrders : inProgressOrders;
      // We look up from sourceList to ensure we have the full object, 
      // although finding it in 'waterOrders' is safer if status changed recently, 
      // but 'sourceList' is sufficient for the builder context.
      return currentListIds.map(id => waterOrders.find(o => o.id === id)).filter((o): o is WaterOrder => !!o);
  }, [currentListIds, activeTab, approvedOrders, inProgressOrders, waterOrders]);

  // Group by Lateral
  const ordersByLateral = useMemo(() => {
    return currentListOrders.reduce((acc, order) => {
      const lateral = order.lateral || 'Unassigned';
      if (!acc[lateral]) {
        acc[lateral] = [];
      }
      acc[lateral].push(order);
      return acc;
    }, {} as Record<string, WaterOrder[]>);
  }, [currentListOrders]);

  const handleAddOrder = (orderId: string) => {
      if (!orderId) return;
      if (activeTab === 'start') {
          setTurnOnIds(prev => [...prev, orderId]);
      } else {
          setTurnOffIds(prev => [...prev, orderId]);
      }
  };

  const handleRemoveOrder = (orderId: string) => {
      if (activeTab === 'start') {
          setTurnOnIds(prev => prev.filter(id => id !== orderId));
      } else {
          setTurnOffIds(prev => prev.filter(id => id !== orderId));
      }
  };

  const initiateScan = (order: WaterOrder) => {
      setScanTargetOrder(order);
      setIsScanning(true);
  };
  
  const handleScan = async (data: string) => {
    setIsScanning(false);
    if (!scanTargetOrder) return;

    try {
      const { action, fieldId, fieldName } = JSON.parse(data);
      
      // Validation
      if (fieldId !== scanTargetOrder.fieldId) {
          alert(`Error: Scanned QR code for ${fieldName} does not match the selected order for ${scanTargetOrder.fieldName}.`);
          return;
      }

      if (activeTab === 'start') {
          if (action !== 'start-delivery') {
              alert("Error: Scanned a 'Stop' QR code but trying to Start delivery.");
              return;
          }
          await updateWaterOrder(scanTargetOrder.id, { ...scanTargetOrder, status: WaterOrderStatus.InProgress });
          setTurnOnIds(prev => prev.filter(id => id !== scanTargetOrder.id)); // Remove from todo list
          alert(`SUCCESS: Water Delivery STARTED for ${fieldName}. Alerts sent.`);
      } else {
          if (action !== 'end-delivery') {
              alert("Error: Scanned a 'Start' QR code but trying to Stop delivery.");
              return;
          }
          await updateWaterOrder(scanTargetOrder.id, { ...scanTargetOrder, status: WaterOrderStatus.Completed });
          setTurnOffIds(prev => prev.filter(id => id !== scanTargetOrder.id)); // Remove from todo list
           alert(`SUCCESS: Water Delivery STOPPED for ${fieldName}. Alerts sent.`);
      }

      await refreshWaterOrders();

    } catch (e) {
      alert('Error scanning QR code. Invalid data format.');
      console.error(e);
    } finally {
        setScanTargetOrder(null);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Ditch Rider Control</h2>
            <p className="text-gray-600">Build your task list for {user.name}</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow p-1 flex">
            <button 
                onClick={() => setActiveTab('start')}
                className={`flex-1 py-4 text-center rounded-md font-bold text-xl transition-colors ${activeTab === 'start' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
            >
                Turn ON
            </button>
            <button 
                onClick={() => setActiveTab('stop')}
                className={`flex-1 py-4 text-center rounded-md font-bold text-xl transition-colors ${activeTab === 'stop' ? 'bg-red-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'}`}
            >
                Turn OFF
            </button>
        </div>
      
        {/* Dropdown Selector */}
        <div className="bg-white p-4 rounded-lg shadow-md border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {activeTab === 'start' ? 'Add Headgate to "Turn ON" List' : 'Add Headgate to "Turn OFF" List'}
            </label>
            <select 
                className="block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                onChange={(e) => {
                    handleAddOrder(e.target.value);
                    e.target.value = ""; // Reset dropdown
                }}
                defaultValue=""
            >
                <option value="" disabled>Select a Headgate / Field...</option>
                {availableOptions.map(order => (
                    <option key={order.id} value={order.id}>
                        {order.fieldName} (Lat {order.lateral}) - {order.requestedAmount} AF
                    </option>
                ))}
                {availableOptions.length === 0 && (
                    <option disabled>No more available orders</option>
                )}
            </select>
        </div>

        {/* Task List */}
        <div>
            {Object.keys(ordersByLateral).length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <p className="text-gray-500 text-lg">Your list is empty.</p>
                    <p className="text-gray-400 text-sm">Select headgates above to build your run.</p>
                </div>
            ) : (
                Object.keys(ordersByLateral).sort().map((lateral) => (
                    <div key={lateral} className="mb-6">
                        <h3 className="text-lg font-bold text-gray-700 mb-2 px-2 bg-gray-200 py-1 rounded-md inline-block">
                            Lateral {lateral}
                        </h3>
                        <div className="space-y-3">
                            {ordersByLateral[lateral].map(order => (
                                <div key={order.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 relative">
                                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                 <h4 className="text-xl font-extrabold text-gray-900">{order.fieldName}</h4>
                                                 <button 
                                                    onClick={() => handleRemoveOrder(order.id)}
                                                    className="text-gray-400 hover:text-red-500 p-1 sm:hidden"
                                                 >
                                                    <TrashIcon className="h-6 w-6" />
                                                 </button>
                                            </div>
                                            <p className="text-gray-600 text-sm">Tap: <span className="font-mono font-bold">{order.tapNumber || 'N/A'}</span></p>
                                            <p className="text-gray-600 text-sm">Amt: <span className="font-mono font-bold">{order.requestedAmount} AF</span></p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={() => handleRemoveOrder(order.id)}
                                                className="hidden sm:inline-flex p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                title="Remove from list"
                                            >
                                                <TrashIcon className="h-6 w-6" />
                                            </button>
                                            <button 
                                                onClick={() => initiateScan(order)}
                                                className={`flex-1 sm:flex-none px-6 py-3 rounded-lg font-bold text-lg text-white shadow-sm flex items-center justify-center space-x-2 transition-transform active:scale-95 ${activeTab === 'start' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
                                            >
                                                <QrCodeIcon className="h-6 w-6" />
                                                <span>SCAN QR</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>

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
