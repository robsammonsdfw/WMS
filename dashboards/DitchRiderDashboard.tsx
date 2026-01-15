
import React, { useMemo, useState } from 'react';
import { User, WaterOrder, WaterOrderStatus, Field } from '../types';
import { QrCodeIcon, ClockIcon, WaterDropIcon, AdjustmentsIcon, XCircleIcon } from '../components/icons';
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
  
  // Local state for assignments, initialized from user prop but editable
  const [myLaterals, setMyLaterals] = useState<string[]>(
    (user.assignedLaterals || []).map(l => l.toLowerCase())
  );
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Derive all unique laterals from the database (Fields + Orders)
  const availableLaterals = useMemo(() => {
    const lats = new Set<string>();
    fields.forEach(f => { 
        if (f.lateral) lats.add(f.lateral); 
        // Also check headgates if field has no direct lateral
        f.headgates?.forEach(hg => {
            if (hg.lateral) lats.add(hg.lateral);
            if (hg.lateral_name) lats.add(hg.lateral_name);
        })
    });
    // Add any laterals found in active orders just in case
    waterOrders.forEach(o => {
        if (o.lateral) lats.add(o.lateral);
        if (o.lateralId) lats.add(o.lateralId);
    });
    
    // Convert to array, trim, lowercase for uniqueness check, then filter empty
    const unique = Array.from(lats)
        .map(l => l.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return unique;
  }, [fields, waterOrders]);

  // Filter Orders based on Local Assignments + Status (Approved OR InProgress)
  const relevantOrders = useMemo(() => {
      // If no laterals assigned, show nothing (or everything if we wanted default behavior)
      if (myLaterals.length === 0) return [];

      return waterOrders.filter(order => {
          // Check Status: We want Approved (Turn On task) OR InProgress (Turn Off task)
          const isActionable = order.status === WaterOrderStatus.Approved || order.status === WaterOrderStatus.InProgress;
          if (!isActionable) return false;

          // Check Lateral Assignment against LOCAL state
          const orderLatId = (order.lateralId || '').toLowerCase();
          const orderLatName = (order.lateral || '').toLowerCase();
          
          const isAssigned = myLaterals.includes(orderLatId) || myLaterals.includes(orderLatName);
          
          return isAssigned;
      });
  }, [waterOrders, myLaterals]);

  // Group by Date
  const groupedOrders = useMemo(() => {
      const groups: Record<string, WaterOrder[]> = {};
      
      relevantOrders.forEach(order => {
          let dateKey = '';
          if (order.status === WaterOrderStatus.Approved) {
              dateKey = order.deliveryStartDate;
          } else {
              dateKey = order.deliveryEndDate || '';
          }
          
          if (!dateKey) {
              dateKey = 'Unscheduled';
          } else {
              dateKey = dateKey.split('T')[0];
          }

          if (!groups[dateKey]) {
              groups[dateKey] = [];
          }
          groups[dateKey].push(order);
      });

      return groups;
  }, [relevantOrders]);

  const sortedDates = useMemo(() => {
      return Object.keys(groupedOrders).sort((a, b) => {
          if (a === 'Unscheduled') return 1;
          if (b === 'Unscheduled') return -1;
          return new Date(a).getTime() - new Date(b).getTime();
      });
  }, [groupedOrders]);

  const toggleLateral = (lat: string) => {
    const lower = lat.toLowerCase();
    setMyLaterals(prev => 
        prev.includes(lower) ? prev.filter(l => l !== lower) : [...prev, lower]
    );
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
      
      if (fieldId !== scanTargetOrder.fieldId) {
          alert(`Error: Scanned QR code for ${fieldName} does not match the selected order.`);
          return;
      }

      if (scanTargetOrder.status === WaterOrderStatus.Approved) {
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
      const today = new Date();
      const isToday = date.getDate() === today.getDate() &&
                      date.getMonth() === today.getMonth() &&
                      date.getFullYear() === today.getFullYear();
      
      if (isToday) return 'Today';
      return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(date);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24">
        {/* Header Control Panel */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 sticky top-0 z-10 flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Ditch Rider Control</h2>
                <button 
                    onClick={() => setIsConfigOpen(true)}
                    className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full transition-colors"
                >
                    <AdjustmentsIcon className="h-6 w-6" />
                </button>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                    Rider: {user.name}
                </div>
                {myLaterals.length > 0 ? (
                    myLaterals.map(l => (
                        <div key={l} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                            Lat {l}
                            <button onClick={() => toggleLateral(l)} className="hover:text-green-900"><XCircleIcon className="h-3 w-3" /></button>
                        </div>
                    ))
                ) : (
                    <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                        No Run Selected
                    </div>
                )}
            </div>
        </div>

        {/* Combined Task List */}
        <div className="space-y-8">
            {sortedDates.length === 0 ? (
                <div className="text-center py-16 bg-white/50 rounded-3xl border-2 border-dashed border-gray-200">
                    <WaterDropIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">
                        {myLaterals.length === 0 ? 'Configure your run to see orders.' : 'No active tasks for selected laterals.'}
                    </p>
                    {myLaterals.length === 0 && (
                        <button onClick={() => setIsConfigOpen(true)} className="mt-4 text-blue-600 font-bold text-sm hover:underline">
                            Select Laterals
                        </button>
                    )}
                </div>
            ) : (
                sortedDates.map((date) => (
                    <div key={date} className="animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-4 mb-4 ml-2 sticky top-36 bg-gray-50/90 backdrop-blur-sm p-2 rounded-xl z-0">
                            <ClockIcon className="h-5 w-5 text-gray-400" />
                            <h3 className="text-lg font-black text-gray-700 uppercase tracking-wide">
                                {formatDateDisplay(date)}
                                {date !== 'Unscheduled' && <span className="ml-3 text-xs text-gray-400 font-bold tracking-normal">{date}</span>}
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {groupedOrders[date].map(order => {
                                const isTurnOn = order.status === WaterOrderStatus.Approved;
                                const themeBg = isTurnOn ? 'bg-blue-600' : 'bg-red-600';
                                const themeShadow = isTurnOn ? 'shadow-blue-100' : 'shadow-red-100';

                                return (
                                    <div key={order.id} className="bg-white rounded-3xl shadow-md overflow-hidden border border-gray-100 relative group">
                                        <div className={`absolute left-0 top-0 bottom-0 w-3 ${themeBg}`}></div>
                                        <div className="p-6 pl-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                                            
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
                                                
                                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2 pl-1">
                                                    {order.fieldName} <span className="mx-1 text-gray-300">|</span> {order.requester}
                                                </p>
                                            </div>

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

      {isScanning && <Scanner onScan={handleScan} onClose={() => setIsScanning(false)} />}
      
      {/* Configuration Modal */}
      {isConfigOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsConfigOpen(false)}>
              <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                  <div className="bg-gray-900 p-6 flex justify-between items-center text-white">
                      <div>
                          <h3 className="font-black text-lg uppercase tracking-wide">Configure Run</h3>
                          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Select Assignments</p>
                      </div>
                      <button onClick={() => setIsConfigOpen(false)}><XCircleIcon className="h-6 w-6 text-gray-400 hover:text-white" /></button>
                  </div>
                  <div className="p-6 max-h-[60vh] overflow-y-auto">
                      <div className="space-y-2">
                          {availableLaterals.length > 0 ? availableLaterals.map(lat => (
                              <label key={lat} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 hover:bg-gray-100 cursor-pointer border border-transparent hover:border-gray-200 transition-all">
                                  <span className="font-black text-gray-700 uppercase">Lateral {lat}</span>
                                  <input 
                                      type="checkbox" 
                                      checked={myLaterals.includes(lat.toLowerCase())}
                                      onChange={() => toggleLateral(lat)}
                                      className="w-6 h-6 rounded-md border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                              </label>
                          )) : (
                              <p className="text-center text-gray-500 italic p-4">No laterals found in current registry.</p>
                          )}
                      </div>
                  </div>
                  <div className="p-4 bg-gray-50 border-t border-gray-100">
                      <button onClick={() => setIsConfigOpen(false)} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase rounded-xl tracking-widest shadow-lg shadow-blue-200 transition-all">
                          Confirm Assignments
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default DitchRiderDashboard;
