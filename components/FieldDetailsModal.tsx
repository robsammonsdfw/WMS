
import React, { useEffect, useState } from 'react';
import { Field, WaterOrder, WaterOrderStatus, WaterOrderType } from '../types';
import { XCircleIcon, DocumentAddIcon } from './icons';

interface FieldDetailsModalProps {
  field: Field;
  orders: WaterOrder[];
  onClose: () => void;
  onCreateOrder: (type: WaterOrderType) => void;
}

const FieldDetailsModal: React.FC<FieldDetailsModalProps> = ({ field, orders, onClose, onCreateOrder }) => {
  // State for real-time updates
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000); // Update every second
    return () => clearInterval(timer);
  }, []);

  const activeOrder = orders.find(o => o.fieldId === field.id && o.status === WaterOrderStatus.InProgress);
  const isRunning = !!activeOrder;

  // --- Real-Time Calculations ---

  // 1. Calculate Rate
  const runningInches = activeOrder?.requestedInches || field.currentRunningInches || 0;
  // Conversion rule: 25 Miner's Inches = 1 Acre-Foot per Day (AFPD)
  const afpd = runningInches / 25; 

  // 2. Calculate Elapsed Time (Duration of current run)
  let daysElapsed = 0;
  if (isRunning && activeOrder?.deliveryStartDate) {
      // Parse Start Date. Note: Date strings (YYYY-MM-DD) parse as UTC midnight usually. 
      // We treat the start date as 00:00:00 of that day in local time for the calculation.
      const startDateParts = activeOrder.deliveryStartDate.split('-');
      const start = new Date(
          parseInt(startDateParts[0]), 
          parseInt(startDateParts[1]) - 1, 
          parseInt(startDateParts[2])
      );
      
      const diffMs = now.getTime() - start.getTime();
      // Ensure we don't show negative days if the start date is technically in the "future" due to timezone edge cases
      daysElapsed = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
  }

  // 3. Calculate Water Used in THIS specific run (Real-time)
  const currentRunAF = isRunning ? (daysElapsed * afpd) : 0;

  // 4. Calculate Historical Totals (Pre-DB + Previous Orders)
  // Note: field.waterUsed comes from DB. We assume DB updates on 'Complete'.
  // So we take DB value + Current Real-time Run value.
  const allocationTotal = Number(field.totalWaterAllocation) || 0;
  const historicalAllocationUsed = Number(field.waterUsed) || 0;
  const realTimeAllocationUsed = historicalAllocationUsed + currentRunAF;
  const allocationRemaining = Math.max(0, allocationTotal - realTimeAllocationUsed);

  const allotmentTotal = Number(field.waterAllotment) || 0;
  const historicalAllotmentUsed = Number(field.allotmentUsed) || 0;
  const realTimeAllotmentUsed = historicalAllotmentUsed + currentRunAF;
  const allotmentRemaining = Math.max(0, allotmentTotal - realTimeAllotmentUsed);

  // 5. Estimate Feed Remaining based on Real-Time Balance
  const daysFeedRemaining = (isRunning && afpd > 0) 
    ? (allotmentRemaining / afpd).toFixed(1) 
    : "0";

  const googleMapsUrl = (field.lat && field.lng) 
    ? `https://www.google.com/maps/dir/?api=1&destination=${field.lat},${field.lng}` 
    : null;

  const history = orders
    .filter(o => o.fieldId === field.id)
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

  return (
    <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
    >
      <div 
        className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row border-4 border-gray-100" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Left Sidebar: Company Info (Yellow Card) */}
        <div className="w-full md:w-80 bg-yellow-400 p-8 flex flex-col justify-between border-r-4 border-white">
            <div className="space-y-6 text-center md:text-left">
                <div className="bg-black/10 p-4 rounded-3xl">
                    <h3 className="text-black font-black uppercase text-[10px] tracking-widest opacity-60">Company Entity</h3>
                    <p className="text-black font-black text-xl leading-tight mt-1">{field.companyName || "Private Entity"}</p>
                </div>
                <div className="space-y-4">
                    <div className="bg-black/5 p-3 rounded-2xl">
                        <h3 className="text-black font-black uppercase text-[8px] tracking-widest opacity-50 mb-1">Address Registry</h3>
                        <p className="text-black/80 font-bold text-[10px] uppercase leading-relaxed">{field.address || "No Address Provided"}</p>
                    </div>
                    <div className="bg-black/5 p-3 rounded-2xl">
                        <h3 className="text-black font-black uppercase text-[8px] tracking-widest opacity-50 mb-1">Primary Contact</h3>
                        <p className="text-black font-black text-lg">{field.phone || "No Phone Registered"}</p>
                    </div>
                    <div className="bg-black/5 p-3 rounded-2xl">
                        <h3 className="text-black font-black uppercase text-[8px] tracking-widest opacity-50 mb-1">Account Owner</h3>
                        <p className="text-black font-black text-sm uppercase tracking-wider">{field.owner || "Owner Undefined"}</p>
                    </div>
                </div>
            </div>
            
            <div className="mt-8">
                {googleMapsUrl ? (
                    <a 
                        href={googleMapsUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="w-full bg-black text-white p-6 rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] flex flex-col items-center justify-center gap-2 hover:bg-gray-800 transition-all text-center"
                    >
                        <span className="text-lg">📍</span>
                        GPS LOCATION & DIRECTIONS
                    </a>
                ) : (
                    <div className="w-full bg-black/20 text-black/40 p-6 rounded-3xl font-black uppercase text-[10px] tracking-[0.2em] text-center border-2 border-dashed border-black/10">
                        GPS Coordinates Missing
                    </div>
                )}
            </div>
        </div>

        {/* Center Panel: Primary Stats */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8">
            {/* Header: Status Indication */}
            <div className={`p-10 rounded-[2.5rem] shadow-xl transition-colors duration-500 text-center ${isRunning ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-red-600 text-white shadow-red-200'}`}>
                <h2 className="text-4xl font-black uppercase tracking-tighter leading-none">{field.name}</h2>
                <div className="mt-4 inline-block bg-white/20 px-6 py-1.5 rounded-full font-black text-[10px] uppercase tracking-[0.3em]">
                    {field.acres} Acres {field.crop}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-8 text-center">
                    <div>
                        <p className="text-white/60 font-black uppercase text-[10px] tracking-widest">Allowance Remaining</p>
                        <p className="text-3xl font-black mt-1">{allocationRemaining.toFixed(1)} <span className="text-xs font-bold opacity-60">ACFT</span></p>
                    </div>
                    <div>
                        <p className="text-white/60 font-black uppercase text-[10px] tracking-widest">Allotment Remaining</p>
                        <p className="text-3xl font-black mt-1">{allotmentRemaining.toFixed(1)} <span className="text-xs font-bold opacity-60">ACFT</span></p>
                    </div>
                </div>
                
                <div className="mt-10 pt-8 border-t border-white/20 space-y-4">
                    <div className="text-white/80 font-black text-xl uppercase tracking-tight">
                        {isRunning ? (
                            <div className="flex flex-col gap-1">
                                <span>CURRENTLY RUNNING: {runningInches}" / {afpd.toFixed(1)} AFPD</span>
                                <span className="text-xs opacity-75">SESSION TOTAL: {currentRunAF.toFixed(2)} AF</span>
                            </div>
                        ) : (
                            <>CURRENTLY OFFLINE</>
                        )}
                    </div>
                    
                    <div className="flex flex-col items-center gap-2">
                        <div className="text-3xl font-black tracking-tighter uppercase">
                            {isRunning ? `${daysElapsed.toFixed(1)} DAYS RUNNING` : `0 DAYS RUNNING`}
                        </div>
                        {isRunning && (
                            <div className="bg-black/20 px-4 py-1 rounded-lg text-sm font-black text-white/90">
                                {daysFeedRemaining} DAYS ESTIMATED FEED REMAINING
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-3xl border-2 border-gray-100">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Billing History</h3>
                    {field.accounts?.length > 0 ? (
                        <div className="space-y-2">
                            {field.accounts.map(acc => (
                                <div key={acc.id} className="flex justify-between bg-white p-3 rounded-xl border border-gray-200">
                                    <span className="font-black text-xs">{acc.accountNumber}</span>
                                    <span className="font-bold text-[10px] text-blue-600">{Number(acc.usageForField || 0).toFixed(1)} AF used</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 bg-white/50 rounded-xl border-2 border-dashed border-gray-200 text-center">
                            <p className="text-[10px] text-gray-400 font-black uppercase">No accounts linked</p>
                        </div>
                    )}
                </div>

                <div className="bg-gray-50 p-6 rounded-3xl border-2 border-gray-100">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Infrastructure Info</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between border-b border-gray-200 pb-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Rider / Lateral</span>
                            <span className="font-black text-gray-900">{field.lateral || "Not Set"}</span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-2">
                            <span className="text-[10px] font-black text-gray-400 uppercase">Headgate / Tap</span>
                            <span className="font-black text-gray-900">{field.tapNumber || field.headgateIds?.[0] || "Not Set"}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Command History */}
            <div className="bg-white p-6 rounded-3xl border-2 border-gray-100">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Recent History</h3>
                <div className="space-y-3">
                    {history.slice(0, 3).map(o => (
                        <div key={o.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <div className={`h-2 w-2 rounded-full ${o.status === WaterOrderStatus.Completed ? 'bg-gray-400' : 'bg-blue-600 animate-pulse'}`}></div>
                                <p className="text-xs font-black">{o.orderDate} - {o.orderType}</p>
                            </div>
                            <span className="text-xs font-black text-gray-900">{o.requestedAmount} AF</span>
                        </div>
                    ))}
                    {history.length === 0 && <p className="text-center text-gray-400 text-xs font-bold uppercase tracking-widest py-4">No prior orders recorded</p>}
                </div>
            </div>
        </div>

        {/* Right Sidebar: Actions */}
        <div className="w-full md:w-64 bg-gray-50 p-8 border-l-4 border-white flex flex-col gap-6">
            <button 
                onClick={() => onCreateOrder(WaterOrderType.TurnOn)}
                className="w-full aspect-square bg-blue-600 text-white p-6 rounded-full font-black uppercase text-[10px] tracking-[0.2em] flex flex-col items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-100 text-center"
            >
                <DocumentAddIcon className="h-8 w-8" />
                TURN ON WATER
            </button>
            
            <button 
                disabled={!isRunning}
                onClick={() => onCreateOrder(WaterOrderType.TurnOff)}
                className={`w-full aspect-square p-6 rounded-full font-black uppercase text-[10px] tracking-[0.2em] flex flex-col items-center justify-center gap-2 transition-all text-center
                    ${isRunning ? 'bg-red-600 text-white shadow-xl shadow-red-100 hover:bg-red-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                `}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                TURN OFF WATER
            </button>

            <button 
                onClick={onClose}
                className="mt-auto w-full py-4 rounded-3xl bg-gray-900 text-white font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all"
            >
                CLOSE COMMAND
            </button>
        </div>
      </div>
    </div>
  );
};

export default FieldDetailsModal;
