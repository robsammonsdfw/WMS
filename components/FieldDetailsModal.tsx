
import React from 'react';
import { Field, WaterOrder, WaterOrderStatus, WaterOrderType } from '../types';
import { XCircleIcon, UserGroupIcon, DocumentAddIcon, RefreshIcon, CheckCircleIcon } from './icons';

interface FieldDetailsModalProps {
  field: Field;
  orders: WaterOrder[];
  onClose: () => void;
  onCreateOrder: () => void;
}

const FieldDetailsModal: React.FC<FieldDetailsModalProps> = ({ field, orders, onClose, onCreateOrder }) => {
  const activeOrder = orders.find(o => o.fieldId === field.id && o.status === WaterOrderStatus.InProgress);
  const isRunning = !!activeOrder;

  // Real-time Calculations
  const allocation = field.totalWaterAllocation || 0;
  const allocationUsed = field.waterUsed || 0;
  const allocationRemaining = Math.max(0, allocation - allocationUsed);

  const allotment = field.waterAllotment || 0;
  const allotmentUsed = field.allotmentUsed || 0;
  const allotmentRemaining = Math.max(0, allotment - allotmentUsed);

  const runningInches = activeOrder?.requestedInches || field.currentRunningInches || 0;
  // Conversion: 25 Miner's Inches = 1 AF per day (AFPD)
  const afpd = runningInches / 25;
  const daysRemaining = (isRunning && afpd > 0) ? (allotmentRemaining / afpd).toFixed(0) : "0";

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
            <div className="space-y-6">
                <div className="bg-black/10 p-4 rounded-3xl">
                    <h3 className="text-black font-black uppercase text-[10px] tracking-widest opacity-60">Company Entity</h3>
                    <p className="text-black font-black text-xl leading-tight mt-1">{field.companyName || "Private Entity"}</p>
                </div>
                <div className="space-y-4">
                    <p className="text-black/80 font-bold text-xs uppercase tracking-widest">{field.address || "No Address Registry"}</p>
                    <p className="text-black font-black text-lg">{field.phone || "No Contact"}</p>
                    <p className="text-black/60 font-black text-sm uppercase tracking-wider">{field.owner || "Owner Undefined"}</p>
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

        {/* Center Panel: Primary Stats (Blue/Red Hexagon Logic) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 space-y-8">
            {/* Header: Status Indication */}
            <div className={`p-8 rounded-[2.5rem] shadow-xl transition-colors duration-500 ${isRunning ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-red-600 text-white shadow-red-200'}`}>
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter leading-none">{field.name}</h2>
                        <p className="text-white/60 font-bold text-xs uppercase tracking-[0.3em] mt-3">
                            {field.acres} Acres {field.crop}
                        </p>
                    </div>
                    <div className="bg-white/20 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest">
                        {isRunning ? 'Running' : 'Offline'}
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/20 grid grid-cols-2 gap-8">
                    <div>
                        <p className="text-white/60 font-black uppercase text-[9px] tracking-widest">Allowance Remaining</p>
                        <p className="text-4xl font-black mt-1">{allocationRemaining.toFixed(1)} <span className="text-sm font-bold opacity-60">ACFT</span></p>
                    </div>
                    <div>
                        <p className="text-white/60 font-black uppercase text-[9px] tracking-widest">Allotment Remaining</p>
                        <p className="text-4xl font-black mt-1">{allotmentRemaining.toFixed(1)} <span className="text-sm font-bold opacity-60">ACFT</span></p>
                    </div>
                </div>
                
                {isRunning && (
                    <div className="mt-6 bg-white/10 p-6 rounded-3xl flex justify-between items-center">
                        <div>
                            <p className="text-white/50 font-black uppercase text-[8px] tracking-widest">Currently Running</p>
                            <p className="text-xl font-black">{runningInches}" <span className="text-[10px] opacity-60">/ {afpd.toFixed(1)} AFPD</span></p>
                        </div>
                        <div className="text-right">
                            <p className="text-white/50 font-black uppercase text-[8px] tracking-widest">Days Remaining</p>
                            <p className="text-3xl font-black tracking-tighter">{daysRemaining}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-gray-50 p-6 rounded-3xl border-2 border-gray-100">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Account Registry</h3>
                    {field.accounts?.length > 0 ? (
                        <div className="space-y-2">
                            {field.accounts.map(acc => (
                                <div key={acc.id} className="flex justify-between bg-white p-3 rounded-xl border border-gray-200">
                                    <span className="font-black text-xs">{acc.accountNumber}</span>
                                    <span className="font-bold text-[10px] text-blue-600">{acc.usageForField?.toFixed(1)} AF used</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 italic">No accounts linked</p>
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
                            <span className="text-[10px] font-black text-gray-400 uppercase">Headgate</span>
                            <span className="font-black text-gray-900">{field.headgateIds?.[0] || "Not Set"}</span>
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
                    {history.length === 0 && <p className="text-center text-gray-400 text-xs italic">No prior orders</p>}
                </div>
            </div>
        </div>

        {/* Right Sidebar: Actions (Green Circles style) */}
        <div className="w-full md:w-64 bg-gray-50 p-8 border-l-4 border-white flex flex-col gap-6">
            <button 
                onClick={onCreateOrder}
                className="w-full aspect-square bg-green-500 text-white p-6 rounded-full font-black uppercase text-[10px] tracking-[0.2em] flex flex-col items-center justify-center gap-2 hover:bg-green-600 transition-all shadow-xl shadow-green-100 text-center"
            >
                <DocumentAddIcon className="h-8 w-8" />
                NEW WATER ORDER
            </button>
            
            <button 
                disabled={!isRunning}
                onClick={onCreateOrder} // In a real app, this would pre-fill 'Turn Off'
                className={`w-full aspect-square p-6 rounded-full font-black uppercase text-[10px] tracking-[0.2em] flex flex-col items-center justify-center gap-2 transition-all text-center
                    ${isRunning ? 'bg-red-500 text-white shadow-xl shadow-red-100 hover:bg-red-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                `}
            >
                <XCircleIcon className="h-8 w-8" />
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
