import React, { useEffect, useState } from 'react';
import { Field, WaterOrder, WaterOrderStatus, WaterOrderType, WaterAccount, AccountAlert, AlertType } from '../types';
import { getWaterAccounts, getAlerts } from '../services/api';

interface RemainingFeedViewProps {
  fields: Field[];
  waterOrders: WaterOrder[];
  onFieldClick: (field: Field) => void;
}

const RemainingFeedView: React.FC<RemainingFeedViewProps> = ({ fields, waterOrders, onFieldClick }) => {
  // State for real-time updates and Alert lookups
  const [now, setNow] = useState(new Date());
  const [accounts, setAccounts] = useState<WaterAccount[]>([]);
  const [alerts, setAlerts] = useState<AccountAlert[]>([]);

  useEffect(() => {
    // Fetch the accounts and alerts specifically for the Feed View
    getWaterAccounts().then(setAccounts).catch(console.error);
    getAlerts().then(setAlerts).catch(console.error);

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

  // Helper to calculate real-time Account Stats for Alert matching
  const calculateAccountStats = (account: WaterAccount) => {
      const accountOrders = waterOrders.filter(o => o.accountNumber === account.accountNumber);
      const usage = accountOrders.reduce((sum, order) => {
        const rate = (order.requestedInches || (order.requestedAmount * 25)) / 25;
        let duration = 0;
        
        if (order.deliveryStartDate) {
            const start = new Date(order.deliveryStartDate);
            if (!isNaN(start.getTime())) {
                if (order.status === WaterOrderStatus.InProgress) {
                     duration = Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                } else if (order.status === WaterOrderStatus.Completed && order.deliveryEndDate) {
                     const end = new Date(order.deliveryEndDate);
                     if (!isNaN(end.getTime())) {
                         duration = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                     }
                }
            }
        }
        return sum + (duration * rate);
      }, 0);

      const total = Number(account.totalAllotment) || 0;
      return { used: usage, total, remaining: Math.max(0, total - usage) };
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 relative">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes feedPulseRed {
            0%, 100% { transform: scale(1); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-color: #ffffff; background-color: #dc2626; }
            50% { transform: scale(1.035); box-shadow: 0 0 35px 5px rgba(255, 255, 255, 0.4); border-color: #fca5a5; background-color: #ef4444; }
        }
        @keyframes feedPulseBlue {
            0%, 100% { transform: scale(1); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-color: #ffffff; background-color: #2563eb; }
            50% { transform: scale(1.035); box-shadow: 0 0 35px 5px rgba(255, 255, 255, 0.4); border-color: #bfdbfe; background-color: #3b82f6; }
        }
        .feed-animate-flash-red { animation: feedPulseRed 7s ease-in-out infinite !important; z-index: 10; }
        .feed-animate-flash-blue { animation: feedPulseBlue 7s ease-in-out infinite !important; z-index: 10; }
      `}} />

      {fields.map(field => {
        const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const parseDate = (dateStr: string) => {
            const parts = dateStr.split('-');
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        };

        // 1. Current State (Running vs Off)
        // Must be InProgress, NOT a "Turn Off" order, and scheduled for today or earlier
        const activeOrder = waterOrders.find(o => {
            if (o.fieldId !== field.id || o.status !== WaterOrderStatus.InProgress) return false;
            if (o.orderType === 'Turn Off' || o.orderType === WaterOrderType.TurnOff) return false;
            
            if (!o.deliveryStartDate) return true; // Fallback if no date is set
            const start = parseDate(o.deliveryStartDate);
            return start.getTime() <= currentDate.getTime();
        });
        
        const isRunning = !!activeOrder;

        // 2. Pending Order Logic (Calendar Aware)
        const futureOrPendingOrders = waterOrders.filter(o => {
             if (o.fieldId !== field.id) return false;
             
             // True if it is explicitly waiting in the queue
             if (o.status === WaterOrderStatus.Pending || o.status === WaterOrderStatus.Approved) return true;
             
             // True if it was instantly moved to InProgress but is scheduled for a future date
             if (o.status === WaterOrderStatus.InProgress && o.deliveryStartDate) {
                 const start = parseDate(o.deliveryStartDate);
                 if (start.getTime() > currentDate.getTime()) return true;
             }
             
             return false;
        });

        // Sort by start date to find the next most immediate order
        futureOrPendingOrders.sort((a, b) => {
             const dateA = a.deliveryStartDate ? parseDate(a.deliveryStartDate).getTime() : Infinity;
             const dateB = b.deliveryStartDate ? parseDate(b.deliveryStartDate).getTime() : Infinity;
             return dateA - dateB;
        });

        const pendingOrder = futureOrPendingOrders[0];

        // 3. Real-time Calculations
        const runningInches = activeOrder?.requestedInches 
            || (activeOrder?.requestedAmount ? activeOrder.requestedAmount * 25 : 0)
            || field.currentRunningInches 
            || 0;
        const currentRateAFPD = runningInches / 25;

        let daysRunningDisplay = "0.0";
        let daysOffDisplay = "0";

        if (isRunning && activeOrder?.deliveryStartDate) {
             const startDateParts = activeOrder.deliveryStartDate.split('-');
             const start = new Date(
                parseInt(startDateParts[0]), 
                parseInt(startDateParts[1]) - 1, 
                parseInt(startDateParts[2])
             );
             const diffMs = now.getTime() - start.getTime();
             const daysFloat = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
             daysRunningDisplay = daysFloat.toFixed(1);
        } else {
             const lastOrder = waterOrders
                .filter(o => o.fieldId === field.id && o.status === WaterOrderStatus.Completed)
                .sort((a, b) => {
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

        const allFieldOrders = waterOrders.filter(o => o.fieldId === field.id);
        const calculatedTotalUsage = allFieldOrders.reduce((sum, order) => {
             const rate = (order.requestedInches || (order.requestedAmount * 25)) / 25;
             let duration = 0;
             const startParts = order.deliveryStartDate.split('-');
             const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));

             // If order is in the future, duration will safely be calculated as 0
             if (order.status === WaterOrderStatus.InProgress) {
                 duration = Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
             } else if (order.status === WaterOrderStatus.Completed && order.deliveryEndDate) {
                 const endParts = order.deliveryEndDate.split('-');
                 const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
                 duration = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
             } 
             return sum + (duration * rate);
        }, 0);

        // 4. Allotment Remaining Calculation
        const allotmentTotal = Number(field.waterAllotment) || 0;
        const finalUsage = Math.max(Number(field.allotmentUsed || 0), calculatedTotalUsage);
        const allotmentRemaining = Math.max(0, allotmentTotal - finalUsage);

        // 5. Alert Trigger Detection (Ignores 'isAcknowledged' so it flashes until fixed)
        let isFlashing = false;
        if (field.primaryAccountNumber) {
            const acc = accounts.find(a => a.accountNumber === field.primaryAccountNumber);
            const linkedAlerts = alerts.filter(a => a.accountNumber === field.primaryAccountNumber);
            
            linkedAlerts.forEach(alert => {
                let triggered = false;
                
                // Account Level Threshold
                if ((alert.alertType === AlertType.Allotment || alert.alertType === AlertType.Both) && acc) {
                    const accStats = calculateAccountStats(acc);
                    if (accStats.total > 0) {
                        const remainingPct = (accStats.remaining / accStats.total) * 100;
                        if (remainingPct <= alert.thresholdPercent) triggered = true;
                    }
                }
                
                // Field Level Threshold
                if (alert.alertType === AlertType.Allocation || alert.alertType === AlertType.Both) {
                    if (allotmentTotal > 0) {
                        const remainingPct = (allotmentRemaining / allotmentTotal) * 100;
                        if (remainingPct <= alert.thresholdPercent) triggered = true;
                    }
                }
                
                if (triggered) isFlashing = true;
            });
        }

        // Apply Styles
        let cardBg = isRunning ? 'bg-blue-600' : 'bg-red-600';
        if (isFlashing) {
            cardBg = isRunning ? 'feed-animate-flash-blue bg-blue-600' : 'feed-animate-flash-red bg-red-600';
        }

        return (
          <div 
            key={field.id} 
            onClick={() => onFieldClick(field)}
            className={`${cardBg} rounded-[2rem] shadow-2xl p-8 flex flex-col items-center justify-center text-center space-y-4 border-4 border-white ring-1 ring-gray-200 cursor-pointer transition-transform hover:scale-[1.03] min-h-[320px]`}
          >
            <h3 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                {field.name}
            </h3>

            <div className="text-white font-black text-xl uppercase tracking-tight">
                {isRunning ? (
                    <>CURRENTLY {runningInches.toFixed(0)}" / {currentRateAFPD.toFixed(1)} ACFT</>
                ) : (
                    <>CURRENTLY OFFLINE</>
                )}
            </div>

            <div className="text-white/90 font-black text-lg uppercase tracking-widest">
                {allotmentRemaining.toFixed(1)} ACFT ALLOTMENT REMAINING
            </div>

            <div className="min-h-[28px]">
                {pendingOrder ? (
                    <div className="bg-white/20 px-4 py-1 rounded-full text-white font-black text-sm uppercase tracking-wider">
                        PENDING ORDER {pendingOrder.orderType === 'Turn Off' || pendingOrder.orderType === WaterOrderType.TurnOff ? 'OFF' : 'ON'} {formatDate(pendingOrder.deliveryStartDate)}
                    </div>
                ) : (
                    <div className="text-white/40 text-xs font-bold uppercase tracking-widest">NO PENDING ORDERS</div>
                )}
            </div>

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