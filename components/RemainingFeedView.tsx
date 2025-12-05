
import React from 'react';
import { Field, WaterOrder, WaterOrderStatus } from '../types';

interface RemainingFeedViewProps {
  fields: Field[];
  waterOrders: WaterOrder[];
}

const RemainingFeedView: React.FC<RemainingFeedViewProps> = ({ fields, waterOrders }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {fields.map(field => {
        // Determine Status
        const isRunning = waterOrders.some(
          o => o.fieldId === field.id && o.status === WaterOrderStatus.InProgress
        );

        // Calculate Totals
        const allocation = field.totalWaterAllocation;
        const used = field.waterUsed;
        const remaining = allocation - used;
        const percentUsed = allocation > 0 ? (used / allocation) * 100 : 0;

        // Visual Configuration
        const cardColor = isRunning ? 'bg-blue-600' : 'bg-red-600';
        const statusText = isRunning ? 'WATER RUNNING' : 'WATER OFF';

        return (
          <div 
            key={field.id} 
            className={`${cardColor} rounded-xl shadow-lg overflow-hidden flex flex-col h-64 border-4 border-white ring-1 ring-gray-200`}
          >
            {/* Header */}
            <div className="p-4 text-center">
              <h3 className="text-2xl font-black text-white tracking-wide uppercase drop-shadow-md">
                {field.name}
              </h3>
              <p className="text-blue-100 text-sm font-semibold opacity-90">{field.crop} • {field.acres} Acres</p>
              <div className="mt-2 inline-block px-3 py-1 rounded-full bg-black bg-opacity-20 text-white text-xs font-bold tracking-wider uppercase">
                {statusText}
              </div>
            </div>

            {/* Totals Section - The "Box with the totals" */}
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
