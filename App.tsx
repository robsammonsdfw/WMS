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

  const handleAuthSuccess = (userData: any, authToken: string) => {
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

    switch (currentUser.role) {
      case UserRole.WaterManager:
      case 'farmer' as any: 
        return <WaterManagerDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} refreshFields={refreshFields} />;
      case UserRole.WaterOffice:
        return <WaterOfficeDashboard waterOrders={waterOrders} refreshWaterOrders={refreshWaterOrders} refreshFields={refreshFields} />;
      case UserRole.DitchRider:
        return <DitchRiderDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} />;
      default:
        return <WaterManagerDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} refreshFields={refreshFields} />;
    }
  }, [currentUser, waterOrders, fields, isLoading, error]);

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
              // Force Header to refresh its local storage read
              window.dispatchEvent(new Event('storage')); 
            }}
            onClose={() => setActiveTab('dashboard')} 
          />
        ) : (
          DashboardComponent
        )}
      </main>
    </div>
  );
};

export default App;