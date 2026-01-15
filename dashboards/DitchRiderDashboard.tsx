
import React, { useMemo, useState } from 'react';
import { User, WaterOrder, WaterOrderStatus, Field } from '../types';
import { QrCodeIcon, ClockIcon, WaterDropIcon } from '../components/icons';
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
  const [isScanning, setIsScanning] = useState(false);
  const [scanTargetOrder, setScanTargetOrder] = useState<WaterOrder | null>(null);

  // 1. Get Assigned Laterals
  const assignedLaterals = useMemo(() => {
      // Normalize to handle potential ID mismatches or lack of assignment
      const lats = user.assignedLaterals || [];
      return lats.map(l => l.toLowerCase());
  }, [user]);

  // 2. Filter Orders based on Role (Assigned Lateral) + Status
  const relevantOrders = useMemo(() => {
      const targetStatus = activeTab === 'start' ? WaterOrderStatus.Approved : WaterOrderStatus.InProgress;
      
      return waterOrders.filter(order => {
          // Check Status
          if (order.status !== targetStatus) return false;

          // Check Lateral Assignment
          // We check both lateralId and lateral property to be safe against data inconsistencies
          const orderLatId = (order.lateralId || '').toLowerCase();
          const orderLatName = (order.lateral || '').toLowerCase();
          
          const isAssigned = assignedLaterals.includes(orderLatId) || assignedLaterals.includes(orderLatName);
          
          return isAssigned;
      });
  }, [waterOrders, activeTab, assignedLaterals]);

  // 3. Group by Date
  const groupedOrders = useMemo(() => {
      const groups: Record<string, WaterOrder[]> = {};
      
      relevantOrders.forEach(order => {
          // Use Start Date for Turn On, End Date for Turn Off
          // If Turn Off has no End Date, group under 'Unscheduled Stop'
          let dateKey = activeTab === 'start' ? order.deliveryStartDate : order.deliveryEndDate;
          
          if (!dateKey) {
              dateKey = 'Unscheduled';
          } else {
              // Ensure clean date string YYYY-MM-DD
              dateKey = dateKey.split('T')[0];
          }

          if (!groups[dateKey]) {
              groups[dateKey] = [];
          }
          groups[dateKey].push(order);
      });

      return groups;
  }, [relevantOrders, activeTab]);

  // Sort dates: Real dates first (chronological), then 'Unscheduled'
  const sortedDates = useMemo(() => {
      return Object.keys(groupedOrders).sort((a, b) => {
          if (a === 'Unscheduled') return 1;
          if (b === 'Unscheduled') return -1;
          return new Date(a).getTime() - new Date(b).getTime();
      });
  }, [groupedOrders]);

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
          alert(`Error: Scanned QR code for ${fieldName} does not match the selected order.`);
          return;
      }

      if (activeTab === 'start') {
          if (action !== 'start-delivery') {
              alert("Error: Scanned a 'Stop' QR code but trying to Start delivery.");
              return;
          }
          await updateWaterOrder(scanTargetOrder.id, { ...scanTargetOrder, status: WaterOrderStatus.InProgress });
          alert(`SUCCESS: Water Delivery STARTED for Lateral ${scanTargetOrder.lateral || scanTargetOrder.lateralId}.`);
      } else {
          if (action !== 'end-delivery') {
              alert("Error: Scanned a 'Start' QR code but trying to Stop delivery.");
              return;
          }
          await updateWaterOrder(scanTargetOrder.id, { ...scanTargetOrder, status: WaterOrderStatus.Completed });
           alert(`SUCCESS: Water Delivery STOPPED for Lateral ${scanTargetOrder.lateral || scanTargetOrder.lateralId}.`);
      }

      await refreshWaterOrders();

    } catch (e) {
      alert('Error scanning QR code. Invalid data format.');
      console.error(e);
    } finally {
        setScanTargetOrder(null);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
      if (dateStr === 'Unscheduled') return 'Unscheduled / Asap';
      const date = new Date(dateStr);
      // Check if date is today
      const today = new Date();
      const isToday = date.getDate() === today.getDate() &&
                      date.getMonth() === today.getMonth() &&
                      date.getFullYear() === today.getFullYear();
      
      if (isToday) return 'Today';

      return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Ditch Rider Control</h2>
            <div className="flex items-center gap-2 mt-2">
                <div className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Rider: {user.name}
                </div>
                <div className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Assignments: {user.assignedLaterals?.join(', ') || 'None'}
                </div>
            </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-[2rem] shadow-lg p-1.5 flex ring-1 ring-gray-100">
            <button 
                onClick={() => setActiveTab('start')}
                className={`flex-1 py-4 text-center rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] transition-all ${activeTab === 'start' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-gray-400 hover:bg-gray-50'}`}
            >
                Turn ON Queue
            </button>
            <button 
                onClick={() => setActiveTab('stop')}
                className={`flex-1 py-4 text-center rounded-[1.5rem] font-black text-sm uppercase tracking-[0.2em] transition-all ${activeTab === 'stop' ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'text-gray-400 hover:bg-gray-50'}`}
            >
                Turn OFF Queue
            </button>
        </div>

        {/* Task List grouped by Date */}
        <div className="space-y-8">
            {sortedDates.length === 0 ? (
                <div className="text-center py-16 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200">
                    <WaterDropIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">No orders scheduled for your laterals.</p>
                </div>
            ) : (
                sortedDates.map((date) => (
                    <div key={date} className="animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-4 mb-4 ml-2">
                            <ClockIcon className="h-5 w-5 text-gray-400" />
                            <h3 className="text-lg font-black text-gray-700 uppercase tracking-wide">
                                {formatDateDisplay(date)}
                                {date !== 'Unscheduled' && <span className="ml-3 text-xs text-gray-400 font-bold tracking-normal">{date}</span>}
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {groupedOrders[date].map(order => (
                                <div key={order.id} className="bg-white rounded-3xl shadow-md overflow-hidden border border-gray-100 relative group">
                                    <div className={`absolute left-0 top-0 bottom-0 w-3 ${activeTab === 'start' ? 'bg-blue-500' : 'bg-red-500'}`}></div>
                                    <div className="p-6 pl-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                                        
                                        {/* Left: Infrastructure Info (Primary) */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-2 py-0.5 bg-gray-900 text-white text-[9px] font-black uppercase rounded tracking-widest">
                                                    LATERAL {order.lateral || order.lateralId}
                                                </span>
                                                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-[9px] font-black uppercase rounded tracking-widest">
                                                    {order.tapNumber ? `TAP ${order.tapNumber}` : `HEADGATE ${order.headgateId || 'Main'}`}
                                                </span>
                                            </div>
                                            <div className="flex items-baseline gap-2">
                                                <h4 className="text-3xl font-black text-gray-900 leading-none">
                                                    {(order.requestedInches || (order.requestedAmount * 25)).toFixed(0)}
                                                    <span className="text-lg text-gray-400 ml-1">IN</span>
                                                </h4>
                                                <span className="text-sm font-bold text-gray-400 uppercase">
                                                    / {order.requestedAmount} ACFT
                                                </span>
                                            </div>
                                            
                                            {/* Field Name is now Secondary */}
                                            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2">
                                                Field: {order.fieldName} <span className="mx-1">•</span> Owner: {order.requester}
                                            </p>
                                        </div>

                                        {/* Right: Action */}
                                        <button 
                                            onClick={() => initiateScan(order)}
                                            className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-white shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95 ${activeTab === 'start' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100' : 'bg-red-600 hover:bg-red-700 shadow-red-100'}`}
                                        >
                                            <QrCodeIcon className="h-5 w-5" />
                                            <span>Scan {activeTab === 'start' ? 'Start' : 'Stop'}</span>
                                        </button>
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
