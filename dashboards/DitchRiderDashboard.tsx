
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
  const [isScanning, setIsScanning] = useState(false);
  const [scanTargetOrder, setScanTargetOrder] = useState<WaterOrder | null>(null);

  // 1. Get Assigned Laterals
  const assignedLaterals = useMemo(() => {
      // Normalize to handle potential ID mismatches or lack of assignment
      const lats = user.assignedLaterals || [];
      return lats.map(l => l.toLowerCase());
  }, [user]);

  // 2. Filter Orders based on Role (Assigned Lateral) + Status (Approved OR InProgress)
  const relevantOrders = useMemo(() => {
      return waterOrders.filter(order => {
          // Check Status: We want Approved (Turn On task) OR InProgress (Turn Off task)
          const isActionable = order.status === WaterOrderStatus.Approved || order.status === WaterOrderStatus.InProgress;
          if (!isActionable) return false;

          // Check Lateral Assignment
          const orderLatId = (order.lateralId || '').toLowerCase();
          const orderLatName = (order.lateral || '').toLowerCase();
          
          const isAssigned = assignedLaterals.includes(orderLatId) || assignedLaterals.includes(orderLatName);
          
          return isAssigned;
      });
  }, [waterOrders, assignedLaterals]);

  // 3. Group by Date
  const groupedOrders = useMemo(() => {
      const groups: Record<string, WaterOrder[]> = {};
      
      relevantOrders.forEach(order => {
          // Determine the "Action Date" based on status
          // If Approved -> Waiting to Start -> Use Start Date
          // If InProgress -> Waiting to Stop -> Use End Date
          let dateKey = '';
          
          if (order.status === WaterOrderStatus.Approved) {
              dateKey = order.deliveryStartDate;
          } else {
              dateKey = order.deliveryEndDate || '';
          }
          
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
  }, [relevantOrders]);

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

      // Determine Action Context based on current status
      if (scanTargetOrder.status === WaterOrderStatus.Approved) {
          // Expecting Turn On
          if (action !== 'start-delivery') {
              alert("Error: Scanned a 'Stop' QR code but trying to Start delivery.");
              return;
          }
          await updateWaterOrder(scanTargetOrder.id, { ...scanTargetOrder, status: WaterOrderStatus.InProgress });
          alert(`SUCCESS: Water Delivery STARTED for Lateral ${scanTargetOrder.lateral || scanTargetOrder.lateralId}.`);
      } else {
          // Expecting Turn Off
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
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 sticky top-0 z-10">
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

        {/* Combined Task List */}
        <div className="space-y-8">
            {sortedDates.length === 0 ? (
                <div className="text-center py-16 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200">
                    <WaterDropIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">No active tasks scheduled.</p>
                </div>
            ) : (
                sortedDates.map((date) => (
                    <div key={date} className="animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-4 mb-4 ml-2 sticky top-24 bg-gray-50/90 backdrop-blur-sm p-2 rounded-xl z-0">
                            <ClockIcon className="h-5 w-5 text-gray-400" />
                            <h3 className="text-lg font-black text-gray-700 uppercase tracking-wide">
                                {formatDateDisplay(date)}
                                {date !== 'Unscheduled' && <span className="ml-3 text-xs text-gray-400 font-bold tracking-normal">{date}</span>}
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {groupedOrders[date].map(order => {
                                const isTurnOn = order.status === WaterOrderStatus.Approved;
                                const themeColor = isTurnOn ? 'blue' : 'red';
                                const themeBg = isTurnOn ? 'bg-blue-600' : 'bg-red-600';
                                const themeShadow = isTurnOn ? 'shadow-blue-100' : 'shadow-red-100';

                                return (
                                    <div key={order.id} className="bg-white rounded-3xl shadow-md overflow-hidden border border-gray-100 relative group">
                                        <div className={`absolute left-0 top-0 bottom-0 w-3 ${themeBg}`}></div>
                                        <div className="p-6 pl-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                                            
                                            {/* Left: Infrastructure Info (Primary) */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`px-2 py-0.5 text-white text-[9px] font-black uppercase rounded tracking-widest ${themeBg}`}>
                                                        {isTurnOn ? 'TURN ON' : 'TURN OFF'}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-gray-900 text-white text-[9px] font-black uppercase rounded tracking-widest">
                                                        LATERAL {order.lateral || order.lateralId}
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

                                                <div className="mt-2 flex items-center gap-3">
                                                     <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-black uppercase rounded tracking-widest border border-gray-200">
                                                        {order.tapNumber ? `TAP ${order.tapNumber}` : `HEADGATE ${order.headgateId || 'Main'}`}
                                                    </span>
                                                </div>
                                                
                                                {/* Field Name Secondary */}
                                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2 pl-1">
                                                    {order.fieldName} <span className="mx-1 text-gray-300">|</span> {order.requester}
                                                </p>
                                            </div>

                                            {/* Right: Action */}
                                            <button 
                                                onClick={() => initiateScan(order)}
                                                className={`w-full sm:w-auto px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-white shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95 ${themeBg} hover:brightness-110 ${themeShadow}`}
                                            >
                                                <QrCodeIcon className="h-5 w-5" />
                                                <span>Scan {isTurnOn ? 'Start' : 'Stop'}</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
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
