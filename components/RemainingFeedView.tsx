
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
        const cleanDate = dateStr.split('T')[0];
        const [year, month, day] = cleanDate.split('-');
        if (year && month && day) return `${month}/${day}/${year.slice(-2)}`;
        return cleanDate;
    } catch (e) { return dateStr; }
  };

  const calculateDaysSince = (dateStr?: string) => {
    if (!dateStr) return 0;
    const past = new Date(dateStr).getTime();
    const now = new Date().getTime();
    const diff = now - past;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
      {fields.map(field => {
        // 1. Current State (Running vs Off)
        const activeOrder = waterOrders.find(
          o => o.fieldId === field.id && o.status === WaterOrderStatus.InProgress
        );
        const isRunning = !!activeOrder;

        // 2. Pending Order Logic (For Turn On or Turn Off)
        const pendingOrder = waterOrders.find(
            o => o.fieldId === field.id && 
            (o.status === WaterOrderStatus.Pending || o.status === WaterOrderStatus.Approved)
        );

        // 3. Days Running / Days Off Calculation
        // We find the last order that caused a state change to determine the duration
        const lastOrder = waterOrders
            .filter(o => o.fieldId === field.id && (o.status === WaterOrderStatus.InProgress || o.status === WaterOrderStatus.Completed))
            .sort((a, b) => new Date(b.deliveryStartDate).getTime() - new Date(a.deliveryStartDate).getTime())[0];
        
        const durationDays = calculateDaysSince(lastOrder?.deliveryStartDate);

        // 4. Rate and Allotment
        const runningInches = activeOrder?.requestedInches 
            || (activeOrder?.requestedAmount ? activeOrder.requestedAmount * 25 : 0)
            || field.currentRunningInches 
            || 0;
            
        const afpd = runningInches / 25; // 25" = 1 AF per day
        const allotmentRemaining = (field.waterAllotment || 0) - (field.allotmentUsed || 0);

        // Style based on state
        const cardBg = isRunning ? 'bg-blue-600' : 'bg-red-600';

        return (
          <div 
            key={field.id} 
            onClick={() => onFieldClick(field)}
            className={`${cardBg} rounded-[2rem] shadow-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 border-4 border-white ring-1 ring-gray-200 cursor-pointer transition-transform hover:scale-[1.03] min-h-[320px]`}
          >
            {/* Field Name */}
            <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                {field.name}
            </h3>

            {/* Currently Running Rate */}
            <div className="text-white font-black text-xl uppercase tracking-tight">
                {isRunning ? (
                    <>CURRENTLY {runningInches.toFixed(0)}" / {afpd.toFixed(1)} ACFT</>
                ) : (
                    <>CURRENTLY OFFLINE</>
                )}
            </div>

            {/* Allotment Remaining */}
            <div className="text-white/90 font-black text-lg uppercase tracking-widest">
                {allotmentRemaining.toFixed(1)} ACFT ALLOTMENT REMAINING
            </div>

            {/* Pending Order Info */}
            <div className="min-h-[28px]">
                {pendingOrder ? (
                    <div className="bg-white/20 px-4 py-1 rounded-full text-white font-black text-sm uppercase tracking-wider">
                        PENDING {pendingOrder.orderType === 'Turn Off' ? 'OFF' : 'ON'} ORDER {formatDate(pendingOrder.deliveryStartDate)}
                    </div>
                ) : (
                    <div className="text-white/40 text-xs font-bold uppercase tracking-widest">NO PENDING ORDERS</div>
                )}
            </div>

            {/* Days Running / Days Off */}
            <div className="text-white font-black text-2xl uppercase tracking-tighter pt-4 border-t border-white/20 w-full">
                {durationDays} DAYS {isRunning ? 'RUNNING' : 'OFF'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RemainingFeedView;
