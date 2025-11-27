import React, { useState } from 'react';
import { ChevronDownIcon } from './icons';

interface SeasonStatisticsProps {
  children: React.ReactNode;
  title?: string;
}

const SeasonStatistics: React.FC<SeasonStatisticsProps> = ({ children, title = "Season Statistics" }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 focus:outline-none transition-colors"
      >
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <div className="flex items-center text-sm text-gray-500">
            <span className="mr-2">{isOpen ? 'Hide' : 'Show'}</span>
            <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>
      {isOpen && (
        <div className="p-6 border-t border-gray-200">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {children}
             </div>
        </div>
      )}
    </div>
  );
};

export default SeasonStatistics;