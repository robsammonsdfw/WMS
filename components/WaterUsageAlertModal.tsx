
import React, { useState, useEffect } from 'react';
import { Field, Account, WaterBankEntry } from '../types';
import { XCircleIcon, BellIcon, RefreshIcon } from './icons';
import { setFieldAccountQueue, getWaterBank } from '../services/api';

interface WaterUsageAlertModalProps {
  field: Field;
  onClose: () => void;
  onUpdate: () => void;
}

const WaterUsageAlertModal: React.FC<WaterUsageAlertModalProps> = ({ field, onClose, onUpdate }) => {
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [queuedAccount, setQueuedAccount] = useState<Account | null>(null);
  const [otherAccounts, setOtherAccounts] = useState<Account[]>([]);
  const [waterBankFields, setWaterBankFields] = useState<WaterBankEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize data
  useEffect(() => {
    if (field.accounts) {
      setActiveAccount(field.accounts.find(a => a.isActive) || field.accounts[0] || null);
      setQueuedAccount(field.accounts.find(a => a.isQueued) || null);
      // "Other" accounts are those not active and not currently queued
      setOtherAccounts(field.accounts.filter(a => !a.isActive && !a.isQueued));
    }

    // Fetch Water Bank data and filter by Lateral
    const fetchBank = async () => {
        try {
            const bankData = await getWaterBank();
            // Filter: Fields from my water bank that are on the same lateral
            // Assuming the field's lateral is available on the field object or first headgate
            const lateral = field.lateral || field.headgates?.[0]?.lateral;
            if (lateral) {
                const relevant = bankData.filter(b => b.lateral === lateral);
                setWaterBankFields(relevant);
            }
        } catch (e) {
            console.error("Failed to load water bank", e);
        }
    };
    fetchBank();
  }, [field]);

  // Handle Drag Start
  const handleDragStart = (e: React.DragEvent, account: Account) => {
    e.dataTransfer.setData("accountId", account.id.toString());
    setIsDragging(true);
  };

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const accountId = parseInt(e.dataTransfer.getData("accountId"));
    
    const accountToQueue = otherAccounts.find(a => a.id === accountId);
    
    if (accountToQueue) {
      // If there was already a queued account, move it back to 'others'
      if (queuedAccount) {
        setOtherAccounts(prev => [...prev, queuedAccount]);
      }
      
      setQueuedAccount(accountToQueue);
      setOtherAccounts(prev => prev.filter(a => a.id !== accountId));
    }
  };

  const handleSave = async () => {
    if (!queuedAccount) return;
    setIsSaving(true);
    try {
        await setFieldAccountQueue(field.id, queuedAccount.id);
        alert(`Account ${queuedAccount.accountNumber} is now queued to take over when usage hits 100%.`);
        onUpdate(); // Refresh dashboard data
        onClose();
    } catch (e) {
        alert("Failed to update account queue. Please try again.");
    } finally {
        setIsSaving(false);
    }
  };

  const activeUsagePercent = activeAccount && activeAccount.allocationForField 
    ? ((activeAccount.usageForField || 0) / activeAccount.allocationForField) * 100 
    : 0;

  return (
    <div className="fixed inset-0 bg-red-900 bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-red-200">
        {/* Header */}
        <div className="bg-red-50 p-6 border-b border-red-100 flex justify-between items-start">
            <div className="flex items-start space-x-4">
                <div className="p-3 bg-red-100 rounded-full animate-bounce">
                    <BellIcon className="h-8 w-8 text-red-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Usage Alert: {field.name}</h2>
                    <p className="text-red-600 font-medium mt-1">
                        Usage has reached 75%. Only 25% remaining on the current account.
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <XCircleIcon className="h-8 w-8" />
            </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Current Status & Queue */}
            <div className="space-y-6">
                {/* Active Account Status */}
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-bl">ACTIVE</div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Current Billing Account</h3>
                    {activeAccount ? (
                        <div>
                            <p className="text-3xl font-mono font-bold text-gray-800">{activeAccount.accountNumber}</p>
                            <p className="text-sm text-gray-500 mb-3">{activeAccount.ownerName}</p>
                            
                            {/* Progress Bar */}
                            <div className="w-full bg-gray-200 rounded-full h-4 mb-1">
                                <div className="bg-red-500 h-4 rounded-full transition-all duration-1000" style={{ width: `${Math.min(activeUsagePercent, 100)}%` }}></div>
                            </div>
                            <div className="flex justify-between text-xs font-medium">
                                <span className="text-red-600">{activeUsagePercent.toFixed(1)}% Used</span>
                                <span className="text-gray-600">{activeAccount.allocationForField} AF Total</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-gray-400 italic">No active account found.</p>
                    )}
                </div>

                {/* Queue Drop Zone */}
                <div 
                    className={`border-2 border-dashed rounded-xl p-6 transition-colors relative min-h-[160px] flex flex-col items-center justify-center
                        ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50'}
                        ${queuedAccount ? 'border-green-400 bg-green-50' : ''}
                    `}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2 absolute top-4 left-4">
                        Next Up (Queue)
                    </h3>
                    
                    {queuedAccount ? (
                        <div className="w-full text-center">
                            <p className="text-2xl font-mono font-bold text-green-700">{queuedAccount.accountNumber}</p>
                            <p className="text-sm text-green-600">{queuedAccount.ownerName}</p>
                            <div className="mt-2 text-xs text-green-800 bg-green-200 inline-block px-2 py-1 rounded">
                                Starts automatically at 100% usage
                            </div>
                            <button 
                                onClick={() => {
                                    setOtherAccounts(prev => [...prev, queuedAccount]);
                                    setQueuedAccount(null);
                                }}
                                className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                            >
                                <XCircleIcon className="h-5 w-5" />
                            </button>
                        </div>
                    ) : (
                        <div className="text-center text-gray-400">
                             <RefreshIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                             <p className="font-medium">Drag available account here</p>
                             <p className="text-xs mt-1">to replace active account when full</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column: Available Accounts & Water Bank */}
            <div className="space-y-6">
                
                {/* Available Accounts List */}
                <div>
                    <h3 className="text-sm font-bold text-gray-700 mb-3">Available Accounts for Field</h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                        {otherAccounts.length > 0 ? (
                            otherAccounts.map(account => {
                                const usage = account.usageForField || 0;
                                const total = account.allocationForField || 0;
                                return (
                                <div
                                    key={account.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, account)}
                                    className="bg-white p-3 rounded shadow-sm border border-gray-200 cursor-move hover:shadow-md hover:border-blue-300 transition-all flex justify-between items-center group"
                                >
                                    <div>
                                        <p className="font-mono font-bold text-gray-800">{account.accountNumber}</p>
                                        <p className="text-xs text-gray-500">{account.ownerName}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-semibold text-gray-800">{usage.toFixed(1)} / {total} AF</p>
                                        <p className="text-xs text-gray-500">{(total - usage).toFixed(1)} AF Left</p>
                                    </div>
                                </div>
                            )})
                        ) : (
                            <p className="text-sm text-gray-500 italic p-2 border border-dashed rounded">No other accounts linked to this field.</p>
                        )}
                    </div>
                </div>

                {/* Water Bank Reference */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <h3 className="text-sm font-bold text-blue-800 mb-2">My Water Bank (Same Lateral)</h3>
                    <p className="text-xs text-blue-600 mb-3">
                        These fields are on the same lateral. You may verify if transfers are needed.
                    </p>
                    {waterBankFields.length > 0 ? (
                        <ul className="space-y-2">
                             {waterBankFields.map(wb => (
                                 <li key={wb.id} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-blue-100">
                                     <span className="font-medium text-gray-700">{wb.fieldAssociation || 'Unassigned Water'}</span>
                                     <span className="font-bold text-blue-600">{wb.amountAvailable} AF</span>
                                 </li>
                             ))}
                        </ul>
                    ) : (
                        <p className="text-xs text-gray-500 italic">No other fields found on this lateral in your Water Bank.</p>
                    )}
                </div>
            </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end space-x-3">
            <button 
                onClick={onClose}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 font-medium"
            >
                Ignore for Now
            </button>
            <button 
                onClick={handleSave}
                disabled={!queuedAccount || isSaving}
                className={`px-4 py-2 rounded-md shadow-sm text-white font-medium flex items-center
                    ${!queuedAccount ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
                `}
            >
                {isSaving && <RefreshIcon className="animate-spin h-4 w-4 mr-2" />}
                Confirm Queue Change
            </button>
        </div>
      </div>
    </div>
  );
};

export default WaterUsageAlertModal;
