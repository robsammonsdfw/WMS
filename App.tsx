import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, WaterOrder, Field } from './types';
import Header from './components/Header';
import WaterManagerDashboard from './dashboards/WaterManagerDashboard';
import WaterOfficeDashboard from './dashboards/WaterOfficeDashboard';
import DitchRiderDashboard from './dashboards/DitchRiderDashboard';
import AuthScreen from './components/AuthScreen';
import UserProfile from './components/UserProfile';
import { getWaterOrders, getFields } from './services/api';

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('wms_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('wms_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'profile'>('dashboard');

  const [waterOrders, setWaterOrders] = useState<WaterOrder[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---> ADD THIS NEW LINE RIGHT HERE <---
  const [simulatedRole, setSimulatedRole] = useState<UserRole | null>(null);

  const handleAuthSuccess = (userData: any, authToken: string) => {
    // ... rest of your code continues here
    const mappedUser: User = {
      id: userData.id,
      name: userData.name, 
      role: userData.role as UserRole,
      email: userData.email,
      city: userData.city,
      phone: userData.phone
    };
    
    localStorage.setItem('wms_token', authToken);
    localStorage.setItem('wms_user', JSON.stringify(mappedUser));
    setToken(authToken);
    setCurrentUser(mappedUser);
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      setError(null);
      const [ordersData, fieldsData] = await Promise.all([getWaterOrders(), getFields()]);
      setWaterOrders(Array.isArray(ordersData) ? ordersData : []);
      setFields(Array.isArray(fieldsData) ? fieldsData : []);
    } catch (err) {
      console.error("Failed to fetch initial data:", err);
      setError("Could not connect to the server. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const refreshWaterOrders = async () => {
      try {
        const ordersData = await getWaterOrders();
        setWaterOrders(Array.isArray(ordersData) ? ordersData : []);
      } catch (err) {
          console.error("Failed to refresh water orders:", err);
      }
  };

  const refreshFields = async () => {
      try {
        const fieldsData = await getFields();
        setFields(Array.isArray(fieldsData) ? fieldsData : []);
      } catch (err) {
          console.error("Failed to refresh fields:", err);
      }
  };

  const DashboardComponent = useMemo(() => {
    if (!currentUser) return null;

    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest mt-10">Loading secure environment...</div>;
    }
    if (error) {
        return <div className="p-8 text-center text-red-600 bg-red-50 rounded-md font-bold uppercase mx-10 mt-10">{error}</div>;
    }

// Determine which role to render based on superuser override
const effectiveRole = (currentUser?.role === UserRole.Superuser && simulatedRole) 
? simulatedRole 
: currentUser?.role;

switch (effectiveRole) {
case UserRole.DistrictOffice:
  return <WaterManagerDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} refreshFields={refreshFields} />;
case UserRole.WaterOffice:
  return <WaterOfficeDashboard waterOrders={waterOrders} refreshWaterOrders={refreshWaterOrders} refreshFields={refreshFields} />;
case UserRole.DitchRider:
  return <DitchRiderDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} />;
case UserRole.Superuser:
default:
  return <WaterManagerDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} refreshFields={refreshFields} />;
}
}, [currentUser, waterOrders, fields, isLoading, error, simulatedRole]); // <-- Added simulatedRole here
  if (!token || !currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header onProfileClick={() => setActiveTab('profile')} />
      
      <main className="p-4 sm:p-6 lg:p-8">
        {activeTab === 'profile' ? (
          <UserProfile 
            user={currentUser} 
            onUpdateUser={(updatedUser) => {
              setCurrentUser(updatedUser);
              window.dispatchEvent(new Event('storage')); 
            }}
            onClose={() => setActiveTab('dashboard')} 
          />
        ) : (
          <>
            {currentUser?.role === UserRole.Superuser && (
              <div className="mb-6 p-4 bg-gray-900 text-white rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-gray-800">
                <div className="font-black uppercase tracking-widest text-sm flex items-center gap-3">
                  <span className="text-red-500 animate-pulse text-lg">●</span> 
                  Superuser View Override
                </div>
                <select
                  value={simulatedRole || ''}
                  onChange={(e) => setSimulatedRole(e.target.value as UserRole)}
                  className="bg-gray-800 text-white border-2 border-gray-700 rounded-xl px-4 py-2.5 font-bold focus:ring-2 focus:ring-blue-500 outline-none min-w-[250px]"
                >
                  <option value="">Default (Water Manager)</option>
                  <option value={UserRole.WaterOffice}>Water Office View</option>
                  <option value={UserRole.DitchRider}>Ditch Rider View</option>
                </select>
              </div>
            )}
            {DashboardComponent}
          </>
        )}
      </main>
    </div>
  );
};

export default App;