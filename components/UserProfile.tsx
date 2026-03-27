import React, { useState } from 'react';
import { User } from '../types';
import { updateUser } from '../services/api';

interface UserProfileProps {
  user: User;
  onUpdateUser: (updatedUser: User) => void;
  onClose: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onUpdateUser, onClose }) => {
  const [name, setName] = useState(user.name || '');
  const [city, setCity] = useState(user.city || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      await updateUser(user.id, { name, city, phone });
      
      const updatedUser = { ...user, name, city, phone };
      localStorage.setItem('wms_user', JSON.stringify(updatedUser));
      onUpdateUser(updatedUser);
      setMessage('Profile updated successfully.');
    } catch (error: any) {
      setMessage(error.message || 'Failed to update profile.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 max-w-2xl mx-auto mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Your Profile</h2>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Back to Dashboard</button>
      </div>

      {message && (
        <div className={`p-4 mb-6 rounded text-sm font-bold ${message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email (Read Only)</label>
          <input type="email" value={user.email} disabled className="mt-1 w-full px-4 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-500" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700">Full Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., John Doe" className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">City</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g., Orem" className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Phone Number</label>
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g., 555-0123" className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500" />
        </div>

        <button type="submit" disabled={isLoading} className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {isLoading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
};

export default UserProfile;