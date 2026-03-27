import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, WaterOrder, Field } from './types';
import Header from './components/Header';
import WaterManagerDashboard from './dashboards/WaterManagerDashboard';
import WaterOfficeDashboard from './dashboards/WaterOfficeDashboard';
import DitchRiderDashboard from './dashboards/DitchRiderDashboard';
import AuthScreen from './components/AuthScreen';
import { getWaterOrders, getFields } from './services/api';

const App: React.FC = () => {
  // 1. Authentication State
  const [token, setToken] = useState<string | null>(localStorage.getItem('wms_token'));
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('wms_user');
    return saved ? JSON.parse(saved) : null;
  });

  // 2. App Data State
  const [waterOrders, setWaterOrders] = useState<WaterOrder[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 3. Auth Handlers
  const handleAuthSuccess = (userData: any, authToken: string) => {
    const mappedUser: User = {
      id: userData.id as any,
      name: userData.email.split('@')[0], 
      role: userData.role as UserRole,
      email: userData.email
    };
    
    localStorage.setItem('wms_token', authToken);
    localStorage.setItem('wms_user', JSON.stringify(mappedUser));
    setToken(authToken);
    setCurrentUser(mappedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('wms_token');
    localStorage.removeItem('wms_user');
    setToken(null);
    setCurrentUser(null);
    setWaterOrders([]);
    setFields([]);
  };

  // 4. Data Fetching (Only runs if authenticated)
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

  // 5. The Gatekeeper: If no token or user, show Login Screen
  if (!token || !currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  const DashboardComponent = useMemo(() => {
    if (isLoading) {
        return <div className="p-8 text-center text-gray-500 font-bold uppercase tracking-widest mt-10">Loading secure environment...</div>;
    }
    if (error) {
        return <div className="p-8 text-center text-red-600 bg-red-50 rounded-md font-bold uppercase mx-10 mt-10">{error}</div>;
    }

    switch (currentUser.role) {
      case UserRole.WaterManager:
      case 'farmer' as UserRole: // Fallback just in case
        return <WaterManagerDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} refreshFields={refreshFields} />;
      case UserRole.WaterOffice:
        return <WaterOfficeDashboard waterOrders={waterOrders} refreshWaterOrders={refreshWaterOrders} refreshFields={refreshFields} />;
      case UserRole.DitchRider:
        return <DitchRiderDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} />;
      default:
        // Default to Water Manager for safety
        return <WaterManagerDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} refreshFields={refreshFields} />;
    }
  }, [currentUser, waterOrders, fields, isLoading, error]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
    <Header />
      
      {/* Temporary Logout Button injected just below the header for easy access during dev */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mt-4 flex justify-end">
        <button 
            onClick={handleLogout} 
            className="text-[10px] font-black text-gray-400 hover:text-red-500 uppercase tracking-widest transition-colors"
        >
            Log Out Secure Session
        </button>
      </div>

      <main className="p-4 sm:p-6 lg:p-8">
        {DashboardComponent}
      </main>
    </div>
  );
};

export default App;