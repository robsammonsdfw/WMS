import React from 'react';
import { Field, WaterOrder, WaterOrderStatus } from '../types';
import { XCircleIcon } from './icons';

interface FieldDetailsModalProps {
  field: Field;
  orders: WaterOrder[];
  onClose: () => void;
}

const FieldDetailsModal: React.FC<FieldDetailsModalProps> = ({ field, orders, onClose }) => {
  // Constants
  const ALLOTMENT_FACTOR = 2.65;
  const ALLOWANCE_FACTOR = 3.75;

  // Calculations
  const allotment = field.acres * ALLOTMENT_FACTOR;
  const allowance = field.acres * ALLOWANCE_FACTOR;
  const used = field.waterUsed;
  
  const activeOrder = orders.find(o => o.fieldId === field.id && o.status === WaterOrderStatus.InProgress);
  
  let durationString = "Not running";
  if (activeOrder && activeOrder.deliveryStartDate) {
      const start = new Date(activeOrder.deliveryStartDate);
      const now = new Date();
      const diffMs = now.getTime() - start.getTime();
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      durationString = `${diffHrs}h ${diffMins}m`;
  }

  const history = orders
    .filter(o => o.fieldId === field.id)
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

  return (
     <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
     >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 relative">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="h-8 w-8"/></button>
            <h2 className="text-2xl font-bold text-gray-800 mb-1">{field.name}</h2>
            <p className="text-gray-500 mb-6">{field.acres} Acres • {field.crop}</p>

            {/* Status Section */}
            <div className={`p-4 rounded-lg mb-6 ${activeOrder ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'}`}>
                <div className="flex items-center space-x-3 mb-2">
                    <div className={`h-3 w-3 rounded-full ${activeOrder ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span className="font-semibold text-lg">{activeOrder ? 'Water Running' : 'Idle'}</span>
                </div>
                {activeOrder ? (
                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                        <div>
                            <p className="text-gray-500">Started At</p>
                            <p className="font-medium">{new Date(activeOrder.deliveryStartDate!).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-gray-500">Running Duration</p>
                            <p className="font-medium">{durationString}</p>
                        </div>
                         <div>
                            <p className="text-gray-500">Requested</p>
                            <p className="font-medium">{activeOrder.requestedAmount.toFixed(2)} AF</p>
                        </div>
                         <div>
                            <p className="text-gray-500">Order ID</p>
                            <p className="font-medium">{activeOrder.id}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">This field is currently not receiving water.</p>
                )}
            </div>

            {/* Usage Stats & Alerts */}
            <div className="space-y-6 mb-8">
                <h3 className="font-semibold text-gray-800">Water Usage & Limits</h3>
                
                {/* Allotment */}
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">Allotment ({ALLOTMENT_FACTOR} AF/ac)</span>
                        <span className={used > allotment ? "text-red-600 font-bold" : "text-gray-600"}>
                            {used.toFixed(1)} / {allotment.toFixed(1)} AF
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full ${used > allotment ? 'bg-red-500' : 'bg-blue-600'}`} style={{width: `${Math.min((used/allotment)*100, 100)}%`}}></div>
                    </div>
                    {used > allotment && <p className="text-xs text-red-600 mt-1 font-semibold">⚠️ Allotment exceeded.</p>}
                </div>

                {/* Allowance */}
                <div>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">Allowance ({ALLOWANCE_FACTOR} AF/ac)</span>
                        <span className={used > allowance ? "text-red-600 font-bold" : "text-gray-600"}>
                             {used.toFixed(1)} / {allowance.toFixed(1)} AF
                        </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                         <div className={`h-2.5 rounded-full ${used > allowance ? 'bg-red-600' : 'bg-indigo-400'}`} style={{width: `${Math.min((used/allowance)*100, 100)}%`}}></div>
                    </div>
                     {used > allowance && <p className="text-xs text-red-600 mt-1 font-bold">⚠️ Maximum Allowance exceeded! Excess charges may apply.</p>}
                </div>
            </div>

            {/* History */}
            <div>
                <h3 className="font-semibold text-gray-800 mb-3">Order History</h3>
                <div className="overflow-x-auto border rounded-md">
                    <table className="min-w-full text-sm text-left text-gray-500">
                        <thead className="bg-gray-50 text-gray-700 uppercase">
                            <tr>
                                <th className="px-4 py-2">Date</th>
                                <th className="px-4 py-2">Amount</th>
                                <th className="px-4 py-2">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length > 0 ? history.map(o => (
                                <tr key={o.id} className="border-b last:border-b-0">
                                    <td className="px-4 py-2">{o.orderDate}</td>
                                    <td className="px-4 py-2">{o.requestedAmount} AF</td>
                                    <td className="px-4 py-2">{o.status}</td>
                                </tr>
                            )) : <tr><td colSpan={3} className="px-4 py-2 text-center">No history</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
      </div>
     </div>
  )
}

export default FieldDetailsModal;