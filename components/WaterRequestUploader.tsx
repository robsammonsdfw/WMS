import React, { useState, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { XCircleIcon, CameraIcon } from './icons';
import { Field } from '../types';

// Declare the global variable that will be created by env-config.js
declare global {
  interface Window {
    APP_CONFIG?: {
      API_KEY: string;
    };
  }
}

interface WaterRequestUploaderProps {
  onClose: () => void;
  onOrderCreated: (data: any) => void;
  fields: Field[];
}

const WaterRequestUploader: React.FC<WaterRequestUploaderProps> = ({ onClose, onOrderCreated, fields }) => {
  const [image, setImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any | null>(null);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Failed to convert blob to base64.'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImage(URL.createObjectURL(file));
    setIsLoading(true);
    setError(null);
    setExtractedData(null);

    // Temporarily bypass Gemini API call until API key is configured.
    // This allows the user to upload an image and manually fill the form.
    setError("Image analysis is not yet configured. Please fill in the details manually.");
    setExtractedData({
        serialNumber: '',
        requestDate: '',
        deliveryAmount: '',
        tapNumber: '',
        lateral: '',
        deliveryStartDate: '',
        owner: ''
    });
    setIsLoading(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onOrderCreated(extractedData);
  };
  
  const FormField = ({ label, value, name }: { label: string, value: any, name: string }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            type={typeof value === 'number' ? 'number' : 'text'}
            name={name}
            id={name}
            value={extractedData[name] || ''}
            onChange={(e) => setExtractedData({...extractedData, [name]: e.target.value})}
            className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
        />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl p-6 sm:p-8 w-full max-w-4xl relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600" aria-label="Close modal">
          <XCircleIcon className="h-8 w-8" />
        </button>
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Upload Water Request Card</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
                <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 relative">
                    {image ? (
                        <img src={image} alt="Water request card preview" className="object-contain w-full h-full rounded-lg" />
                    ) : (
                        <div className="text-center text-gray-500 p-4">
                            <CameraIcon className="h-12 w-12 mx-auto text-gray-400" />
                            <p>Upload a photo to begin</p>
                        </div>
                    )}
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                           <div className="text-center">
                             <svg className="animate-spin h-8 w-8 text-indigo-600 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                             </svg>
                             <p className="mt-2 text-indigo-700 font-semibold">Analyzing card...</p>
                           </div>
                        </div>
                    )}
                </div>
                 <input
                    type="file"
                    id="imageUpload"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                />
                <label htmlFor="imageUpload" className="w-full text-center cursor-pointer inline-block px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    {image ? 'Upload Different Image' : 'Choose Image'}
                </label>
            </div>
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Extracted Information</h3>
                <p className="text-sm text-gray-500 -mt-2">Please review and correct any details below before creating the order.</p>

                {error && <div className="p-4 rounded-md bg-yellow-50 text-yellow-800">{error}</div>}

                {extractedData && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <FormField label="Owner / Farm" name="owner" value={extractedData.owner} />
                           <FormField label="Serial No." name="serialNumber" value={extractedData.serialNumber} />
                           <FormField label="Lateral" name="lateral" value={extractedData.lateral} />
                           <FormField label="Tap No." name="tapNumber" value={extractedData.tapNumber} />
                           <FormField label="Delivery Amount" name="deliveryAmount" value={extractedData.deliveryAmount} />
                           <FormField label="Delivery Start Date" name="deliveryStartDate" value={extractedData.deliveryStartDate} />
                        </div>
                        <div className="flex justify-end space-x-3 pt-4">
                             <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                             <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Water Order</button>
                        </div>
                    </form>
                )}

                {!extractedData && !isLoading && !error && (
                    <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
                        <p className="text-gray-500">Data will appear here after analysis.</p>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default WaterRequestUploader;