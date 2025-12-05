
import React from 'react';
import { Field, WaterOrder, WaterOrderStatus } from '../types';
import { XCircleIcon, UserGroupIcon, DocumentAddIcon } from './icons';

interface FieldDetailsModalProps {
  field: Field;
  orders: WaterOrder[];
  onClose: () => void;
  onCreateOrder: () => void;
}

const FieldDetailsModal: React.FC<FieldDetailsModalProps> = ({ field, orders, onClose, onCreateOrder }) => {
  // Safe number access to prevent crashes if API returns null
  const allocation = field.totalWaterAllocation || 0;
  const used = field.waterUsed || 0;
  const remaining = allocation - used;

  const activeOrder = orders.find(o => o.fieldId === field.id && o.status === WaterOrderStatus.InProgress);
  
  const history = orders
    .filter(o => o.fieldId === field.id)
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

  // Determine primary lateral from headgates or fallback
  const headgates = field.headgates && field.headgates.length > 0 ? field.headgates : [];
  // For display purposes, if there are accounts, we list them. 
  const accounts = field.accounts && field.accounts.length > 0 ? field.accounts : [];

  return (
     <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
        onClick={onClose}
        role="dialog"
        aria-modal="true"
     >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Scrollable Content */}
        <div className="p-6 relative space-y-6 overflow-y-auto flex-1">
            <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="h-8 w-8"/></button>
            
            {/* 1. Field Name */}
            <h2 className="text-3xl font-extrabold text-gray-900 border-b pb-2 pr-8">{field.name}</h2>

            {/* 2. Balance of Water */}
            <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 shadow-sm">
               <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wide mb-1">Balance of Water</h3>
               <div className="flex items-baseline space-x-2">
                  <span className={`text-5xl font-black ${remaining < 0 ? 'text-red-600' : 'text-blue-700'}`}>
                    {remaining.toFixed(1)} <span className="text-xl font-bold text-blue-600">AF</span>
                  </span>
               </div>
               <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-blue-800 flex justify-between font-medium">
                  <span>Used: <span className="font-bold">{used.toFixed(1)}</span> AF</span>
                  <span>Allocation: <span className="font-bold">{allocation.toFixed(1)}</span> AF</span>
               </div>
            </div>

            {/* 3. Account Numbers */}
            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <div className="flex items-center space-x-2 mb-2">
                    <UserGroupIcon className="h-4 w-4 text-indigo-500" />
                    <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wide">Account Numbers</h3>
                </div>
                {accounts.length > 0 ? (
                    <ul className="space-y-2">
                        {accounts.map(acc => {
                             // Find associated headgate if it exists
                             const linkedHeadgate = headgates.find(hg => hg.id === acc.headgateId);
                             return (
                                <li key={acc.id} className="bg-white p-2 rounded shadow-sm border border-indigo-100 flex justify-between items-center">
                                    <span className="font-mono font-bold text-indigo-900">{acc.accountNumber}</span>
                                    {linkedHeadgate && (
                                        <span className="text-xs text-gray-500">
                                            Lat {linkedHeadgate.lateral} / Tap {linkedHeadgate.tapNumber}
                                        </span>
                                    )}
                                </li>
                             );
                        })}
                    </ul>
                ) : (
                    <p className="text-sm text-gray-500 italic">No accounts assigned.</p>
                )}
            </div>


            <div className="grid grid-cols-2 gap-4">
                {/* 4. Headgate Info */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Headgate Info</h3>
                    {headgates.length > 0 ? (
                        <div className="space-y-3">
                            {headgates.map((hg, idx) => (
                                <div key={hg.id || idx} className="border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                                    <p className="text-gray-700 text-xs uppercase">Lateral <strong className="text-gray-900 text-lg">{hg.lateral}</strong></p>
                                    <p className="text-gray-700 text-xs">Tap # <strong className="text-gray-900">{hg.tapNumber}</strong></p>
                                </div>
                            ))}
                        </div>
                    ) : (
                         <div className="space-y-1">
                             {/* Fallback for legacy data */}
                            <p className="text-gray-700 text-sm">Lateral</p>
                            <p className="text-gray-900 font-bold text-xl">{field.lateral || 'N/A'}</p>
                            <div className="h-2"></div>
                            <p className="text-gray-700 text-sm">Tap Number</p>
                            <p className="text-gray-900 font-bold text-xl">{field.tapNumber || 'N/A'}</p>
                        </div>
                    )}
                </div>

                {/* 5. Crop / Acres */}
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Crop / Acres</h3>
                    <div className="space-y-1">
                        <p className="text-gray-700 text-sm">Crop</p>
                        <p className="text-gray-900 font-bold text-lg truncate" title={field.crop}>{field.crop}</p>
                         <div className="h-2"></div>
                        <p className="text-gray-700 text-sm">Size</p>
                        <p className="text-gray-900 font-bold text-xl">{field.acres} <span className="text-sm font-normal text-gray-600">Acres</span></p>
                    </div>
                </div>
            </div>

            {/* 6. Location */}
             <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Location</h3>
                <p className="text-gray-800 font-medium text-lg leading-snug">{field.location || "Location not specified"}</p>
            </div>

            {/* 7. History / Stats */}
            <div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 border-t pt-4">History / Stats</h3>
                
                {/* Current Status Indicator */}
                <div className={`flex items-center p-3 rounded-lg mb-4 border ${activeOrder ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    <div className={`h-3 w-3 rounded-full mr-3 ${activeOrder ? 'bg-green-600 animate-pulse' : 'bg-gray-400'}`}></div>
                    <span className="font-bold uppercase tracking-wide text-sm">{activeOrder ? 'Water Running' : 'Water Off'}</span>
                </div>

                {/* Recent History Table */}
                <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm">
                    <table className="min-w-full text-sm text-left">
                        <thead className="bg-gray-100 text-gray-700 font-bold">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Amount</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {history.length > 0 ? history.slice(0, 5).map(o => (
                                <tr key={o.id}>
                                    <td className="px-4 py-3 text-gray-600">{o.orderDate}</td>
                                    <td className="px-4 py-3 font-bold text-gray-900">{o.requestedAmount} AF</td>
                                    <td className="px-4 py-3">
                                         <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                                            o.status === WaterOrderStatus.Completed ? 'bg-gray-100 text-gray-700 border-gray-300' :
                                            o.status === WaterOrderStatus.InProgress ? 'bg-green-100 text-green-700 border-green-200' :
                                            'bg-blue-50 text-blue-700 border-blue-200'
                                         }`}>
                                            {o.status}
                                         </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400 italic">No recent order history found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-200">
            <button 
                onClick={onCreateOrder}
                className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
                <DocumentAddIcon className="-ml-1 mr-2 h-5 w-5" />
                Create Water Order
            </button>
        </div>
      </div>
     </div>
  );
};

export default FieldDetailsModal;
