import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { WaterDropIcon, BellIcon, UserGroupIcon, ChevronDownIcon } from './icons';

interface HeaderProps {
  onProfileClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onProfileClick }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeUserName, setActiveUserName] = useState<string>('Loading...');
  const [activeUserRole, setActiveUserRole] = useState<string>('');

  useEffect(() => {
    const storedUser = localStorage.getItem('wms_user');
    if (storedUser) {
      try {
        const user: User = JSON.parse(storedUser);
        const emailPrefix = user.email ? user.email.split('@')[0] : 'User';
        setActiveUserName(user.name || emailPrefix);
        setActiveUserRole(user.role || '');
      } catch (e) {
        console.error('Failed to parse user from local storage');
      }
    }
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('wms_token');
    localStorage.removeItem('wms_user');
    window.location.reload(); 
  };

  const handleProfileNav = (e: React.MouseEvent) => {
    e.preventDefault();
    setDropdownOpen(false);
    onProfileClick();
  };

  return (
    <header className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-2">
            <WaterDropIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">AquaTrack</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              <BellIcon className="h-6 w-6" />
            </button>
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <UserGroupIcon className="h-5 w-5 text-gray-600" />
                <div className="text-left">
                  <p className="font-semibold text-sm">{activeUserName}</p>
                  <p className="text-xs text-gray-500">{activeUserRole}</p>
                </div>
                <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1" role="menu">
                    <button
                      onClick={handleProfileNav}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Your Profile
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;