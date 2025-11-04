import React, { useState, useMemo } from 'react';
import { Field } from '../types';
import { FIELDS } from '../constants';
import { XCircleIcon, DocumentAddIcon } from './icons';

interface NewWaterOrderModalProps {
  onClose: () => void;
  onOrderCreate: (data: { fieldId: string; requestedAmount: number; deliveryStartDate: string; }) => void;
}

const NewWaterOrderModal: React.FC<NewWaterOrderModalProps> = ({ onClose, onOrderCreate }) => {
  const [fieldId, setFieldId] = useState<string>('');
  const [requestedAmount, setRequestedAmount] = useState<string>('');
  const [deliveryStartDate, setDeliveryStartDate] = useState<string>('');
  const [error, setError] = useState('');

  const selectedField = useMemo(() => FIELDS.find(f => f.id === fieldId), [fieldId]);
  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const amount = parseFloat(requestedAmount);
    if (!fieldId || !requestedAmount || amount <= 0 || !deliveryStartDate) {
      setError('Please fill out all fields with valid information.');
      return;
    }

    onOrderCreate({
      fieldId,
      requestedAmount: amount,
      deliveryStartDate,
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
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
            <div className="bg-blue-100 p-2 rounded-full">
                <DocumentAddIcon className="h-6 w-6 text-blue-600" />
            </div>
            <h2 id="new-order-title" className="text-2xl font-bold text-gray-800">Create New Water Order</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="field" className="block text-sm font-medium text-gray-700">Field</label>
                <select
                    id="field"
                    value={fieldId}
                    onChange={(e) => setFieldId(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                    <option value="" disabled>Select a field...</option>
                    {FIELDS.map(field => (
                        <option key={field.id} value={field.id}>{field.name} ({field.owner})</option>
                    ))}
                </select>
            </div>
            
            {selectedField && (
                <div className="p-3 bg-gray-50 rounded-md border border-gray-200 text-sm">
                    <p><span className="font-medium text-gray-600">Lateral:</span> {selectedField.lateral}</p>
                    <p><span className="font-medium text-gray-600">Tap Number:</span> {selectedField.tapNumber}</p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div>
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Requested Amount (AF)</label>
                    <input
                        type="number"
                        id="amount"
                        value={requestedAmount}
                        onChange={(e) => setRequestedAmount(e.target.value)}
                        min="0.1"
                        step="0.1"
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="e.g., 50"
                    />
                </div>
                <div>
                    <label htmlFor="date" className="block text-sm font-medium text-gray-700">Delivery Start Date</label>
                    <input
                        type="date"
                        id="date"
                        value={deliveryStartDate}
                        onChange={(e) => setDeliveryStartDate(e.target.value)}
                        min={today}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Submit Order</button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default NewWaterOrderModal;
