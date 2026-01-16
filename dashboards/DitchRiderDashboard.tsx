
import React, { useMemo, useState, useEffect } from 'react';
import { User, WaterOrder, WaterOrderStatus, WaterOrderType, Field, Lateral } from '../types';
import { QrCodeIcon, ClockIcon, WaterDropIcon, AdjustmentsIcon, XCircleIcon, CheckCircleIcon } from '../components/icons';
import Scanner from '../components/Scanner';
import { updateWaterOrder, getLaterals } from '../services/api';

interface DitchRiderDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
  fields: Field[];
  refreshWaterOrders: () => Promise<void>;
}

const DitchRiderDashboard: React.FC<DitchRiderDashboardProps> = ({ user, waterOrders, fields, refreshWaterOrders }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanTargetOrder, setScanTargetOrder] = useState<WaterOrder | null>(null);
  
  // State for all laterals in the system (fetched from DB)
  const [allSystemLaterals, setAllSystemLaterals] = useState<Lateral[]>([]);

  // Local state for assignments. 
  const [myLaterals, setMyLaterals] = useState<string[]>(
    (user.assignedLaterals || []).map(l => l.toLowerCase())
  );
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // 1. Fetch official registry laterals
  // 2. Scan active orders for any "legacy" or text-based laterals to ensure they are visible
  useEffect(() => {
    const syncLaterals = async () => {
        let dbLaterals: Lateral[] = [];
        try {
            dbLaterals = await getLaterals() || [];
            setAllSystemLaterals(dbLaterals);
        } catch (e) { console.error(e); }

        const activeOrderLaterals = new Set<string>();
        waterOrders.forEach(o => {
            if (o.lateralId) activeOrderLaterals.add(o.lateralId.toLowerCase());
            if (o.lateral) activeOrderLaterals.add(o.lateral.toLowerCase());
        });

        const dbIds = dbLaterals.map(d => d.id.toLowerCase());
        const dbNames = dbLaterals.map(d => d.name.toLowerCase());

        setMyLaterals(prev => {
            // Combine previous (user assigned) + DB Registry + Found in Orders
            const combined = new Set([
                ...prev, 
                ...dbIds, 
                ...dbNames, 
                ...Array.from(activeOrderLaterals)
            ]);
            return Array.from(combined);
        });
    };

    syncLaterals();
  }, [waterOrders]); // Re-run if orders change to catch new incoming orders

  // Derive all unique laterals from the database (Fields + Orders + DB Laterals) for the config menu
  const availableLaterals = useMemo(() => {
    const lats = new Set<string>();
    
    // Add known system laterals from API
    allSystemLaterals.forEach(l => {
        if(l.name) lats.add(l.name);
        if(l.id) lats.add(l.id);
    });

    // Add inferred from fields (for legacy/direct-type support)
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
  }, [fields, waterOrders, allSystemLaterals]);

  // Filter Orders based on Local Assignments + Status (Approved OR InProgress)
  const relevantOrders = useMemo(() => {
      return waterOrders.filter(order => {
          // Check Status: We want Approved (Pending Task) OR InProgress (Active Task)
          const isActionable = order.status === WaterOrderStatus.Approved || order.status === WaterOrderStatus.InProgress;
          if (!isActionable) return false;

          // Check Lateral Assignment against LOCAL state
          const orderLatId = (order.lateralId || '').toLowerCase();
          const orderLatName = (order.lateral || '').toLowerCase();
          
          // If the order has NO lateral assigned, show it anyway so it isn't lost
          if (!orderLatId && !orderLatName) return true;

          const isAssigned = myLaterals.includes(orderLatId) || myLaterals.includes(orderLatName);
          return isAssigned;
      });
  }, [waterOrders, myLaterals]);

  // Group by Date
  const groupedOrders = useMemo(() => {
      const groups: Record<string, WaterOrder[]> = {};
      
      relevantOrders.forEach(order => {
          let dateKey = '';
          // If it's a Turn Off order, the relevant date is usually the End Date (or start date if explicit Turn Off record)
          // Since our data model uses deliveryStartDate as the primary "Action Date", we use that for Approved.
          if (order.status === WaterOrderStatus.Approved) {
              dateKey = order.deliveryStartDate;
          } else {
              // For InProgress orders, we are looking at when it ends
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

  const handleManualAction = async (order: WaterOrder) => {
      const isTurnOff = order.orderType === WaterOrderType.TurnOff;
      const isApproved = order.status === WaterOrderStatus.Approved;
      
      let actionName = 'Update';
      if (isApproved) actionName = isTurnOff ? 'Stop' : 'Start';
      else actionName = 'Stop';

      if (!window.confirm(`Manual Override: Confirm "${actionName}" for ${order.fieldName}?`)) return;

      try {
          if (order.status === WaterOrderStatus.Approved) {
              if (isTurnOff) {
                  // Pending Turn Off -> Completed
                   await updateWaterOrder(order.id, { ...order, status: WaterOrderStatus.Completed });
              } else {
                  // Pending Turn On -> In Progress
                   await updateWaterOrder(order.id, { ...order, status: WaterOrderStatus.InProgress });
              }
          } else if (order.status === WaterOrderStatus.InProgress) {
              // Running -> Completed
              await updateWaterOrder(order.id, { ...order, status: WaterOrderStatus.Completed });
          }
          await refreshWaterOrders();
      } catch (e) {
          alert("Failed to update order status");
      }
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
      
      const isTurnOffType = scanTargetOrder.orderType === WaterOrderType.TurnOff;

      if (scanTargetOrder.status === WaterOrderStatus.Approved) {
          // If the order is "Turn Off", we expect an end-delivery scan
          if (isTurnOffType) {
              if (action !== 'end-delivery') {
                  alert("Error: Scanned a 'Start' QR code but this is a Turn Off order.");
                  return;
              }
              await updateWaterOrder(scanTargetOrder.id, { ...scanTargetOrder, status: WaterOrderStatus.Completed });
              alert(`SUCCESS: Water Delivery STOPPED for Lateral ${scanTargetOrder.lateral || scanTargetOrder.lateralId}.`);
          } else {
              // Standard Turn On Order
              if (action !== 'start-delivery') {
                  alert("Error: Scanned a 'Stop' QR code but trying to Start delivery.");
                  return;
              }
              await updateWaterOrder(scanTargetOrder.id, { ...scanTargetOrder, status: WaterOrderStatus.InProgress });
              alert(`SUCCESS: Water Delivery STARTED for Lateral ${scanTargetOrder.lateral || scanTargetOrder.lateralId}.`);
          }
      } else {
          // If In Progress, we are stopping it
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

  // Helper to get local date string YYYY-MM-DD
  const getLocalTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (dateStr: string) => {
      if (dateStr === 'Unscheduled') return 'Unscheduled / Asap';
      
      const todayStr = getLocalTodayStr();
      if (dateStr === todayStr) return 'Today';
      
      const [y, m, d] = dateStr.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      
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
                    myLaterals.slice(0, 5).map(l => (
                        <div key={l} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                            {l.replace('lateral', 'Lat')}
                            <button onClick={() => toggleLateral(l)} className="hover:text-green-900"><XCircleIcon className="h-3 w-3" /></button>
                        </div>
                    ))
                ) : (
                    <div className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-[10px] font-black uppercase tracking-widest">
                        No Run Selected
                    </div>
                )}
                {myLaterals.length > 5 && (
                    <span className="text-[10px] text-gray-500 font-bold">+{myLaterals.length - 5} more</span>
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
                                // --- VISUAL LOGIC ---
                                
                                // 1. Sidebar Color (Type of Order)
                                // Turn On = Blue. Turn Off = Red.
                                const isTurnOffType = order.orderType === WaterOrderType.TurnOff;
                                const barColor = isTurnOffType ? 'bg-red-600' : 'bg-blue-600';
                                const shadowColor = isTurnOffType ? 'shadow-red-100' : 'shadow-blue-100';

                                // 2. Widget Status (Current Water State)
                                // If InProgress -> Water is Running (Blue).
                                // If Approved (Pending) -> 
                                //    If Type is Turn On -> Water is currently OFF (Red).
                                //    If Type is Turn Off -> Water is currently ON (Blue).
                                let isWaterRunning = false;
                                if (order.status === WaterOrderStatus.InProgress) {
                                    isWaterRunning = true;
                                } else if (order.status === WaterOrderStatus.Approved) {
                                    isWaterRunning = isTurnOffType; 
                                }

                                const widgetBg = isWaterRunning ? 'bg-blue-600' : 'bg-red-600';
                                const widgetText = isWaterRunning ? 'WATER RUNNING' : 'WATER OFF';

                                // 3. Action Text
                                let actionText = '';
                                if (order.status === WaterOrderStatus.Approved) {
                                    actionText = isTurnOffType ? 'Stop' : 'Start';
                                } else {
                                    actionText = 'Stop';
                                }

                                return (
                                    <div key={order.id} className="bg-white rounded-3xl shadow-md overflow-hidden border border-gray-100 relative group">
                                        <div className={`absolute left-0 top-0 bottom-0 w-3 ${barColor} transition-colors duration-500`}></div>
                                        <div className="p-6 pl-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                                            
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`px-2 py-0.5 text-white text-[9px] font-black uppercase rounded tracking-widest ${widgetBg} transition-colors duration-500`}>
                                                        {widgetText}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-gray-900 text-white text-[9px] font-black uppercase rounded tracking-widest">
                                                        {(order.lateral || order.lateralId) ? `LATERAL ${order.lateral || order.lateralId}` : 'UNASSIGNED LATERAL'}
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

                                            <div className="flex flex-col gap-2 w-full sm:w-auto">
                                                <button 
                                                    onClick={() => initiateScan(order)}
                                                    className={`w-full sm:w-auto px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] text-white shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95 ${barColor} hover:brightness-110 ${shadowColor}`}
                                                >
                                                    <QrCodeIcon className="h-5 w-5" />
                                                    <span>Scan {actionText}</span>
                                                </button>
                                                
                                                <button 
                                                    onClick={() => handleManualAction(order)}
                                                    className="w-full text-center text-[10px] font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 py-2 rounded-xl transition-colors uppercase tracking-widest"
                                                >
                                                    Manual {actionText}
                                                </button>
                                            </div>
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
