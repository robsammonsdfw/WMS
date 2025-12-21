
import React from 'react';
import { Field, WaterOrder, WaterOrderStatus } from '../types';

interface RemainingFeedViewProps {
  fields: Field[];
  waterOrders: WaterOrder[];
  onFieldClick: (field: Field) => void;
}

const RemainingFeedView: React.FC<RemainingFeedViewProps> = ({ fields, waterOrders, onFieldClick }) => {

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Asap';
    try {
        // Handle ISO strings (2025-12-09T00...) or simple dates (2025-12-09)
        const cleanDate = dateStr.split('T')[0];
        const [year, month, day] = cleanDate.split('-');
        if (year && month && day) {
            return `${month}-${day}-${year}`;
        }
        return cleanDate;
    } catch (e) {
        return dateStr;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {fields.map(field => {
        // 1. Determine Current Status (Is Water ON?)
        const activeOrder = waterOrders.find(
          o => o.fieldId === field.id && o.status === WaterOrderStatus.InProgress
        );
        const isRunning = !!activeOrder;

        // 2. Determine Pending Status (Is something waiting?)
        const pendingOrder = waterOrders.find(
            o => o.fieldId === field.id && 
            (o.status === WaterOrderStatus.Pending || o.status === WaterOrderStatus.Approved)
        );

        // Calculate Totals
        const allocation = typeof field.totalWaterAllocation === 'number' ? field.totalWaterAllocation : 0;
        const used = typeof field.waterUsed === 'number' ? field.waterUsed : 0;
        
        const remaining = allocation - used;
        const percentUsed = allocation > 0 ? (used / allocation) * 100 : 0;

        // --- Visual Configuration Logic ---
        let cardColor = 'bg-red-600'; 
        let statusBadge = null;
        let pendingBadge = null;

        if (isRunning) {
            // CASE: Water is currently ON
            cardColor = 'bg-blue-600';
            
            statusBadge = (
                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-blue-800 text-white border border-blue-400 shadow-sm">
                    WATER RUNNING
                </div>
            );

            if (pendingOrder) {
                // CASE: Water ON, but Pending Order exists (Pending Turn Off/Switch)
                pendingBadge = (
                     <div className="mt-1 inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-red-100 text-red-800 border border-red-300 shadow-sm">
                        PENDING: {formatDate(pendingOrder.deliveryStartDate)}
                    </div>
                );
            }

        } else {
            // CASE: Water is currently OFF
            cardColor = 'bg-red-600'; // User Requirement: Stays Red if Off

            statusBadge = (
                <div className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-red-900 text-red-100 border border-red-800 shadow-sm">
                    WATER OFF
                </div>
            );
            
            if (pendingOrder) {
                // CASE: Water OFF, but Pending Order exists (Pending Turn On)
                // User Requirement: "PENDING" badge is White/Blue for high visibility.
                pendingBadge = (
                     <div className="mt-1 inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-white text-blue-800 border-2 border-blue-600 shadow-md animate-pulse">
                        PENDING START: {formatDate(pendingOrder.deliveryStartDate)}
                    </div>
                );
            }
        }

        return (
          <div 
            key={field.id} 
            onClick={() => onFieldClick(field)}
            className={`${cardColor} rounded-xl shadow-lg overflow-hidden flex flex-col h-64 border-4 border-white ring-1 ring-gray-200 cursor-pointer transition-transform hover:scale-[1.02]`}
          >
            {/* Header */}
            <div className="p-4 text-center">
              <h3 className="text-2xl font-black text-white tracking-wide uppercase drop-shadow-md truncate">
                {field.name}
              </h3>
              <p className="text-blue-100 text-sm font-semibold opacity-90">{field.crop} • {field.acres} Acres</p>
              
              <div className="mt-2 flex flex-col items-center justify-center space-y-1 min-h-[50px]">
                 {statusBadge}
                 {pendingBadge}
              </div>
            </div>

            {/* Totals Section */}
            <div className="flex-1 bg-white mx-4 mb-4 rounded-lg p-4 flex flex-col justify-center shadow-inner">
              <div className="grid grid-cols-2 gap-4 text-center mb-3">
                <div className="flex flex-col">
                    <span className="text-xs text-gray-500 font-bold uppercase">Used</span>
                    <span className="text-xl font-bold text-gray-800">{used.toFixed(1)} <span className="text-xs text-gray-400">AF</span></span>
                </div>
                <div className="flex flex-col border-l border-gray-200">
                    <span className="text-xs text-gray-500 font-bold uppercase">Remaining</span>
                    <span className={`text-xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {remaining.toFixed(1)} <span className="text-xs text-gray-400">AF</span>
                    </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-6 relative overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${
                        percentUsed > 100 ? 'bg-red-500' : 
                        percentUsed > 85 ? 'bg-orange-400' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                >
                    {percentUsed.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RemainingFeedView;
