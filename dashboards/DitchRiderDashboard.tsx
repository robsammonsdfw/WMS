
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

  // Local state for assignments with Persistence
  const [myLaterals, setMyLaterals] = useState<string[]>(() => {
      const saved = localStorage.getItem(`ditch-rider-assignments-${user.id}`);
      if (saved) {
          try {
              return JSON.parse(saved);
          } catch (e) { console.error("Failed to parse saved assignments", e); }
      }
      // Default fallback
      return (user.assignedLaterals || []).map(l => l.toLowerCase().trim());
  });
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Fetch official registry laterals to populate options
  useEffect(() => {
    const fetchSystemInfo = async () => {
        try {
            const dbLaterals = await getLaterals() || [];
            setAllSystemLaterals(dbLaterals);
        } catch (e) { console.error(e); }
    };
    fetchSystemInfo();
  }, []);

  // Derive all unique laterals from the database (Fields + Orders + DB Laterals) for the config menu
  // Deduplicate case-insensitively and trim whitespace
  const availableLaterals = useMemo(() => {
    const uniqueMap = new Map<string, string>(); // lowercase -> display
    
    const add = (val?: string) => {
        if (!val) return;
        const trimmed = val.trim();
        if (!trimmed) return;
        const lower = trimmed.toLowerCase();
        if (!uniqueMap.has(lower)) {
            uniqueMap.set(lower, trimmed);
        }
    };

    // Add known system laterals from API
    allSystemLaterals.forEach(l => {
        add(l.name);
        add(l.id);
    });

    // Add inferred from fields (for legacy/direct-type support)
    fields.forEach(f => { 
        add(f.lateral);
        f.headgates?.forEach(hg => {
            add(hg.lateral);
            add(hg.lateral_name);
        })
    });
    // Add any laterals found in active orders just in case
    waterOrders.forEach(o => {
        add(o.lateral);
        add(o.lateralId);
    });
    
    return Array.from(uniqueMap.values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [fields, waterOrders, allSystemLaterals]);

  // Filter Orders based on Local Assignments + Status (Approved OR InProgress)
  const relevantOrders = useMemo(() => {
      return waterOrders.filter(order => {
          // Check Status: We want Approved (Pending Task) OR InProgress (Active Task)
          const isActionable = order.status === WaterOrderStatus.Approved || order.status === WaterOrderStatus.InProgress;
          if (!isActionable) return false;

          // Check Lateral Assignment against LOCAL state
          // Robust comparison: handle nulls, trim whitespace, lowercase
          const orderLatId = (order.lateralId || '').trim().toLowerCase();
          const orderLatName = (order.lateral || '').trim().toLowerCase();
          
          // If the order has NO lateral assigned, show it anyway so it isn't lost
          if (!orderLatId && !orderLatName) return true;

          const isAssigned = myLaterals.includes(orderLatId) || myLaterals.includes(orderLatName);
          return isAssigned;
      });
  }, [waterOrders, myLaterals]);

  // Group by Date
  const groupedOrders = useMemo(() => {
      const groups: Record<string, WaterOrder[]> = {};
      
      const scheduledTurnOffSignatures = new Set<string>();

      relevantOrders.forEach(order => {
          if (order.status === WaterOrderStatus.Approved && order.orderType === WaterOrderType.TurnOff) {
               const sig = `${order.fieldId}-${order.lateralId || order.lateral}-${order.tapNumber || order.headgateId}`;
               scheduledTurnOffSignatures.add(sig);
          }

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

      if (groups['Unscheduled']) {
          groups['Unscheduled'] = groups['Unscheduled'].filter(uOrder => {
              if (uOrder.status === WaterOrderStatus.InProgress) {
                   const sig = `${uOrder.fieldId}-${uOrder.lateralId || uOrder.lateral}-${uOrder.tapNumber || uOrder.headgateId}`;
                   if (scheduledTurnOffSignatures.has(sig)) {
                       return false;
                   }
              }
              return true;
          });
          if (groups['Unscheduled'].length === 0) {
              delete groups['Unscheduled'];
          }
      }

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
    const lower = lat.trim().toLowerCase();
    setMyLaterals(prev => {
        const newState = prev.includes(lower) ? prev.filter(l => l !== lower) : [...prev, lower];
        localStorage.setItem(`ditch-rider-assignments-${user.id}`, JSON.stringify(newState));
        return newState;
    });
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

      const todayStr = new Date().toISOString().split('T')[0];

      try {
          if (order.status === WaterOrderStatus.Approved) {
              if (isTurnOff) {
                   // Stopping water: Set status to Completed AND stamp End Date
                   await updateWaterOrder(order.id, { 
                       ...order, 
                       status: WaterOrderStatus.Completed,
                       deliveryEndDate: todayStr
                   });
              } else {
                   // Starting water
                   await updateWaterOrder(order.id, { ...order, status: WaterOrderStatus.InProgress });
              }
          } else if (order.status === WaterOrderStatus.InProgress) {
              // Stopping water
              await updateWaterOrder(order.id, { 
                  ...order, 
                  status: WaterOrderStatus.Completed,
                  deliveryEndDate: todayStr
               });
          }
          await refreshWaterOrders();
      } catch (e) {
          alert("Failed to update order status");
      }
  };
  
  const handleScan = async (data: string) => {
    setIsScanning(false);
    if (!scanTargetOrder) return;

    const todayStr = new Date().toISOString().split('T')[0];

    try {
      const { action, fieldId, fieldName } = JSON.parse(data);
      
      if (fieldId !== scanTargetOrder.fieldId) {
          alert(`Error: Scanned QR code for ${fieldName} does not match the selected order.`);
          return;
      }
      
      const isTurnOffType = scanTargetOrder.orderType === WaterOrderType.TurnOff;

      if (scanTargetOrder.status === WaterOrderStatus.Approved) {
          if (isTurnOffType) {
              if (action !== 'end-delivery') {
                  alert("Error: Scanned a 'Start' QR code but this is a Turn Off order.");
                  return;
              }
              await updateWaterOrder(scanTargetOrder.id, { 
                  ...scanTargetOrder, 
                  status: WaterOrderStatus.Completed,
                  deliveryEndDate: todayStr
              });
              alert(`SUCCESS: Water Delivery STOPPED for Lateral ${scanTargetOrder.lateral || scanTargetOrder.lateralId}.`);
          } else {
              if (action !== 'start-delivery') {
                  alert("Error: Scanned a 'Stop' QR code but trying to Start delivery.");
                  return;
              }
              await updateWaterOrder(scanTargetOrder.id, { ...scanTargetOrder, status: WaterOrderStatus.InProgress });
              alert(`SUCCESS: Water Delivery STARTED for Lateral ${scanTargetOrder.lateral || scanTargetOrder.lateralId}.`);
          }
      } else {
          if (action !== 'end-delivery') {
              alert("Error: Scanned a 'Start' QR code but trying to Stop delivery.");
              return;
          }
          await updateWaterOrder(scanTargetOrder.id, { 
              ...scanTargetOrder, 
              status: WaterOrderStatus.Completed,
              deliveryEndDate: todayStr
          });
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
      
      const todayStr = new Date().toISOString().split('T')[0];
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
                        No Assignments
                    </div>
                )}
                {myLaterals.length > 5 && (
                    <div className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                        +{myLaterals.length - 5} More
                    </div>
                )}
            </div>

            {/* CONFIG MENU (Collapsible) */}
            {isConfigOpen && (
                <div className="mt-4 pt-4 border-t border-gray-100 animate-in fade-in slide-in-from-top-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Manage My Route (Select Active Channels)</p>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                        {availableLaterals.map(latDisplay => {
                            const lower = latDisplay.toLowerCase();
                            const isActive = myLaterals.includes(lower);
                            return (
                                <button
                                    key={latDisplay}
                                    onClick={() => toggleLateral(latDisplay)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                                        isActive 
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                                    }`}
                                >
                                    {latDisplay}
                                </button>
                            );
                        })}
                    </div>
                    <button onClick={() => setIsConfigOpen(false)} className="mt-3 w-full py-2 bg-gray-50 text-gray-400 text-xs font-bold rounded-lg hover:bg-gray-100">Close Config</button>
                </div>
            )}
        </div>

        {/* Date Groups */}
        <div className="space-y-8">
            {sortedDates.map(dateKey => {
                const orders = groupedOrders[dateKey];
                if (!orders || orders.length === 0) return null;

                return (
                    <div key={dateKey} className="animate-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center mb-4 sticky top-28 bg-gray-50/95 backdrop-blur py-2 z-0">
                            <div className="h-3 w-3 rounded-full bg-indigo-500 mr-3 shadow-lg shadow-indigo-200"></div>
                            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest">{formatDateDisplay(dateKey)}</h3>
                            <div className="flex-1 h-px bg-gray-200 ml-4"></div>
                        </div>

                        <div className="space-y-4">
                            {orders.map(order => {
                                const isTurnOff = order.orderType === WaterOrderType.TurnOff;
                                const isRunning = order.status === WaterOrderStatus.InProgress;

                                let cardColorClass = 'bg-white border-l-4 border-blue-500';
                                let actionLabel = isTurnOff ? 'Stop' : 'Start';
                                if (isRunning) {
                                    actionLabel = isTurnOff ? 'Stop' : 'Running'; 
                                    if(isTurnOff) cardColorClass = 'bg-white border-l-4 border-red-500';
                                    else cardColorClass = 'bg-white border-l-4 border-green-500';
                                } else if (isTurnOff) {
                                     cardColorClass = 'bg-white border-l-4 border-red-500';
                                }

                                return (
                                    <div key={order.id} className={`p-6 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 relative overflow-hidden group ${cardColorClass}`}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                     <span className="text-[10px] font-black uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded text-gray-500">
                                                        {order.lateralId || order.lateral}
                                                     </span>
                                                     <span className="text-[10px] font-black uppercase tracking-widest bg-gray-100 px-2 py-0.5 rounded text-gray-500">
                                                        Tap {order.tapNumber || order.headgateId}
                                                     </span>
                                                </div>
                                                <h4 className="text-xl font-black text-gray-900 leading-tight">{order.fieldName}</h4>
                                                <p className="text-xs font-bold text-gray-400 uppercase mt-1">{order.orderType}</p>
                                                {order.accountNumber && (
                                                    <span className="inline-block mt-2 text-[9px] font-black bg-emerald-100 text-emerald-800 px-2 py-1 rounded">ACCT: {order.accountNumber}</span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-2xl font-black text-gray-800">{order.requestedAmount} <span className="text-xs text-gray-400">AF</span></span>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-6 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                                <ClockIcon className="h-4 w-4" />
                                                {order.deliveryStartDate}
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleManualAction(order)}
                                                    className="p-3 rounded-xl bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600 font-bold text-[10px] uppercase tracking-wider"
                                                >
                                                    Manual
                                                </button>

                                                <button 
                                                    onClick={() => initiateScan(order)}
                                                    className="flex items-center gap-2 px-5 py-3 bg-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black hover:scale-105 transition-all shadow-lg shadow-gray-200"
                                                >
                                                    <QrCodeIcon className="h-4 w-4" />
                                                    Scan to {actionLabel}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {sortedDates.length === 0 && (
                <div className="text-center py-20 opacity-50">
                    <WaterDropIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-lg font-black text-gray-400 uppercase">No active tasks for selected channels</p>
                    <p className="text-xs text-gray-400 mt-2">Check your lateral assignments in the configuration menu.</p>
                </div>
            )}
        </div>

        {isScanning && <Scanner onScan={handleScan} onClose={() => setIsScanning(false)} />}
    </div>
  );
};

export default DitchRiderDashboard;