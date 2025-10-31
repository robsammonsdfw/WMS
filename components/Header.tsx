
import React, { useState } from 'react';
import { User } from '../types';
import { WaterDropIcon, BellIcon, UserGroupIcon, ChevronDownIcon } from './icons';

interface HeaderProps {
  currentUser: User;
  users: User[];
  onUserChange: (userId: number) => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, users, onUserChange }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleSelectUser = (userId: number) => {
    onUserChange(userId);
    setDropdownOpen(false);
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
                  <p className="font-semibold text-sm">{currentUser.name}</p>
                  <p className="text-xs text-gray-500">{currentUser.role}</p>
                </div>
                <ChevronDownIcon className={`h-5 w-5 text-gray-500 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                    {users.map(user => (
                      <a
                        key={user.id}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handleSelectUser(user.id);
                        }}
                        className={`block px-4 py-2 text-sm ${currentUser.id === user.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}`}
                        role="menuitem"
                      >
                        <span className="font-medium">{user.name}</span> - <span className="text-gray-500">{user.role}</span>
                      </a>
                    ))}
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
