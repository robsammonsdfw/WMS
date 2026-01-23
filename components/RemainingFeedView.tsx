
import React, { useEffect, useState } from 'react';
import { Field, WaterOrder, WaterOrderStatus } from '../types';

interface RemainingFeedViewProps {
  fields: Field[];
  waterOrders: WaterOrder[];
  onFieldClick: (field: Field) => void;
}

const RemainingFeedView: React.FC<RemainingFeedViewProps> = ({ fields, waterOrders, onFieldClick }) => {
  // State for real-time updates (syncs with Modal logic)
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000); // Update every second
    return () => clearInterval(timer);
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Asap';
    try {
        const cleanDate = dateStr.split('T')[0];
        const [year, month, day] = cleanDate.split('-');
        if (year && month && day) return `${month}/${day}/${year.slice(-2)}`;
        return cleanDate;
    } catch (e) { return dateStr; }
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

        // 3. Real-time Calculations
        // Rate
        const runningInches = activeOrder?.requestedInches 
            || (activeOrder?.requestedAmount ? activeOrder.requestedAmount * 25 : 0)
            || field.currentRunningInches 
            || 0;
        const afpd = runningInches / 25; // 25" = 1 AF per day

        // Duration & Consumption
        let daysRunningDisplay = "0.0";
        let daysOffDisplay = "0";
        let currentRunAF = 0;

        if (isRunning && activeOrder?.deliveryStartDate) {
             // Calculate precise days running
             const startDateParts = activeOrder.deliveryStartDate.split('-');
             const start = new Date(
                parseInt(startDateParts[0]), 
                parseInt(startDateParts[1]) - 1, 
                parseInt(startDateParts[2])
             );
             // Use the 'now' state
             const diffMs = now.getTime() - start.getTime();
             const daysFloat = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
             
             daysRunningDisplay = daysFloat.toFixed(1);
             currentRunAF = daysFloat * afpd;
        } else {
             // Calculate integer days off based on last Completed order
             const lastOrder = waterOrders
                .filter(o => o.fieldId === field.id && o.status === WaterOrderStatus.Completed)
                .sort((a, b) => {
                    // Sort by End Date if available, else Start Date
                    const dateA = a.deliveryEndDate || a.deliveryStartDate;
                    const dateB = b.deliveryEndDate || b.deliveryStartDate;
                    return new Date(dateB).getTime() - new Date(dateA).getTime();
                })[0];
             
             if (lastOrder) {
                 const dateStr = lastOrder.deliveryEndDate || lastOrder.deliveryStartDate;
                 if (dateStr) {
                    const parts = dateStr.split('-');
                    const end = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    const diffMs = now.getTime() - end.getTime();
                    const daysInt = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    daysOffDisplay = Math.max(0, daysInt).toString();
                 }
             }
        }

        // 4. Allotment Remaining Calculation
        // Formula: (Total Allotment) - (Historical Used from DB + Real-time Used in Current Session)
        const allotmentTotal = Number(field.waterAllotment) || 0;
        const historicalUsed = Number(field.allotmentUsed) || 0;
        const allotmentRemaining = Math.max(0, allotmentTotal - (historicalUsed + currentRunAF));

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
                {isRunning ? `${daysRunningDisplay} DAYS RUNNING` : `${daysOffDisplay} DAYS OFF`}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RemainingFeedView;
