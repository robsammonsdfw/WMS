import React from 'react';
import { Field } from '../types';
import { XCircleIcon } from './icons';

interface QRCodeModalProps {
  field: Field;
  onClose: () => void;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ field, onClose }) => {
  const generateQRUrl = (data: object) => {
    const encodedData = encodeURIComponent(JSON.stringify(data));
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedData}`;
  };

  const startData = { action: 'start-delivery', fieldId: field.id, fieldName: field.name };
  const endData = { action: 'end-delivery', fieldId: field.id, fieldName: field.name };

  const startQRUrl = generateQRUrl(startData);
  const endQRUrl = generateQRUrl(endData);

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div 
        className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-2xl relative" 
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close modal"
        >
          <XCircleIcon className="h-8 w-8" />
        </button>
        <h2 id="qr-modal-title" className="text-2xl font-bold text-gray-800 mb-2">QR Codes for {field.name}</h2>
        <p className="text-gray-600 mb-6">A ditch rider can scan these codes to start or end a water delivery.</p>
        
        <div className="flex flex-col sm:flex-row justify-around items-center gap-8">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-green-600 mb-2">Start Delivery</h3>
            <div className="p-2 border-4 border-green-500 rounded-lg inline-block">
                <img src={startQRUrl} alt="Start Delivery QR Code" width="200" height="200" />
            </div>
            <p className="text-sm text-gray-500 mt-2">Scan to begin water delivery.</p>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-red-600 mb-2">End Delivery</h3>
             <div className="p-2 border-4 border-red-500 rounded-lg inline-block">
                <img src={endQRUrl} alt="End Delivery QR Code" width="200" height="200" />
            </div>
            <p className="text-sm text-gray-500 mt-2">Scan to complete water delivery.</p>
          </div>
        </div>
         <div className="mt-8 text-center">
            <button 
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            >
                Close
            </button>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
