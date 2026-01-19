
import React, { useState, useMemo } from 'react';
import { Field, WaterOrderType } from '../types';
import { XCircleIcon, DocumentAddIcon } from './icons';

interface NewWaterOrderModalProps {
  onClose: () => void;
  onOrderCreate: (data: { fieldId: string; orderType: WaterOrderType; requestedAmount: number; deliveryStartDate: string; deliveryEndDate?: string; }) => void;
  fields: Field[];
  initialFieldId?: string;
  initialOrderType: WaterOrderType;
}

const NewWaterOrderModal: React.FC<NewWaterOrderModalProps> = ({ onClose, onOrderCreate, fields, initialFieldId, initialOrderType }) => {
  const [fieldId, setFieldId] = useState<string>(initialFieldId || '');
  const [inchesRequested, setInchesRequested] = useState<string>('');
  const [deliveryStartDate, setDeliveryStartDate] = useState<string>('');
  const [deliveryEndDate, setDeliveryEndDate] = useState<string>('');
  const [error, setError] = useState('');

  const isTurnOn = initialOrderType === WaterOrderType.TurnOn;

  const selectedField = useMemo(() => fields.find(f => f.id === fieldId), [fieldId, fields]);
  
  // Get today's date in LOCAL timezone (YYYY-MM-DD)
  // New Date() gives local time, but toISOString() converts to UTC.
  // We construct the string manually to ensure it stays in the user's timezone.
  const today = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Derive primary headgate info
  const headgateInfo = useMemo(() => {
    if (!selectedField) return null;
    if (selectedField.headgates && selectedField.headgates.length > 0) {
        return selectedField.headgates[0];
    }
    // Fallback
    return { lateral: selectedField.lateral, tapNumber: selectedField.tapNumber };
  }, [selectedField]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Basic validation
    if (!fieldId || !deliveryStartDate) {
      setError('Please select a field and a date.');
      return;
    }
    
    // Specific validation for Turn On
    if (isTurnOn) {
        const inches = parseFloat(inchesRequested);
        if (!inchesRequested || inches <= 0) {
             setError('Please enter a valid amount of water (inches).');
             return;
        }
    }
    
    if (!selectedField) {
        setError('Invalid field selected.');
        return;
    }

    // Convert Miner's Inches to Acre-Feet (AF) based on rule: 25 Inches = 1 AF
    let amountAF = 0;
    if (isTurnOn && inchesRequested) {
        amountAF = parseFloat(inchesRequested) / 25;
    }

    onOrderCreate({
      fieldId,
      orderType: initialOrderType,
      requestedAmount: parseFloat(amountAF.toFixed(2)),
      deliveryStartDate,
      deliveryEndDate: isTurnOn ? (deliveryEndDate || undefined) : undefined,
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-order-title"
    >
      <div 
        className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-lg relative" 
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close modal"
        >
          <XCircleIcon className="h-8 w-8" />
        </button>
        <div className="flex items-center space-x-3 mb-4">
            <div className={`p-2 rounded-full ${isTurnOn ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                <DocumentAddIcon className="h-6 w-6" />
            </div>
            <h2 id="new-order-title" className="text-2xl font-bold text-gray-800">
                {isTurnOn ? 'Start Water Delivery' : 'Stop Water Delivery'}
            </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="field" className="block text-sm font-medium text-gray-700">Field</label>
                {initialFieldId && selectedField ? (
                    // Read-only view if field is pre-selected
                    <div className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm sm:text-sm text-gray-800 font-medium">
                        {selectedField.name} ({selectedField.owner || 'No Owner'})
                    </div>
                ) : (
                    // Dropdown view if no field pre-selected
                    <select
                        id="field"
                        value={fieldId}
                        onChange={(e) => setFieldId(e.target.value)}
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                    >
                        <option value="" disabled>Select a field...</option>
                        {fields.map(field => (
                            <option key={field.id} value={field.id}>{field.name} ({field.owner || 'No Owner'})</option>
                        ))}
                    </select>
                )}
            </div>
            
            {selectedField && headgateInfo && (
                <div className="p-3 bg-gray-50 rounded-md border border-gray-200 text-sm grid grid-cols-2 gap-2">
                    <p><span className="font-medium text-gray-600">Lateral:</span> {headgateInfo.lateral || 'N/A'}</p>
                    <p><span className="font-medium text-gray-600">Tap Number:</span> {headgateInfo.tapNumber || 'N/A'}</p>
                    <p><span className="font-medium text-gray-600">Acres:</span> {selectedField.acres}</p>
                    {selectedField.headgates && selectedField.headgates.length > 1 && (
                         <p className="col-span-2 text-xs text-blue-600 italic">
                             *Field has {selectedField.headgates.length} headgates available. Order defaults to primary.
                         </p>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 {isTurnOn && (
                     <div>
                        <label htmlFor="inches" className="block text-sm font-medium text-gray-700">Inches Requested</label>
                        <input
                            type="number"
                            id="inches"
                            value={inchesRequested}
                            onChange={(e) => setInchesRequested(e.target.value)}
                            min="0.1"
                            step="0.1"
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="e.g., 25"
                        />
                        {inchesRequested && (
                            <p className="text-xs text-gray-500 mt-1">
                                {/* Conversion: 25 Inches = 1 AF */}
                                ≈ {(parseFloat(inchesRequested) / 25).toFixed(2)} AF
                            </p>
                        )}
                    </div>
                 )}
                
                <div className={!isTurnOn ? 'sm:col-span-2' : ''}>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                        {isTurnOn ? 'Delivery Start Date' : 'Turn Off Date'}
                    </label>
                    <input
                        type="date"
                        id="date"
                        value={deliveryStartDate}
                        onChange={(e) => setDeliveryStartDate(e.target.value)}
                        min={today}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                </div>

                {/* Optional Stop Date - Only show for Turn On */}
                {isTurnOn && (
                    <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Delivery Stop Date (Optional)</label>
                        <input
                            type="date"
                            id="endDate"
                            value={deliveryEndDate}
                            onChange={(e) => setDeliveryEndDate(e.target.value)}
                            min={deliveryStartDate || today}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        />
                    </div>
                )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                <button type="submit" className={`px-6 py-2 text-white rounded-md transition-colors ${isTurnOn ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}>
                    {isTurnOn ? 'Start Water' : 'Stop Water'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default NewWaterOrderModal;
