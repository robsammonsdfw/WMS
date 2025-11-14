import React, { useState, useMemo, useEffect } from 'react';
import { User, UserRole, WaterOrder, Field } from './types';
import { USERS } from './constants';
import Header from './components/Header';
import WaterManagerDashboard from './dashboards/WaterManagerDashboard';
import WaterOfficeDashboard from './dashboards/WaterOfficeDashboard';
import DistrictOfficeDashboard from './dashboards/DistrictOfficeDashboard';
import DitchRiderDashboard from './dashboards/DitchRiderDashboard';
import { getWaterOrders, getFields } from './services/api';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(USERS[0]);
  const [waterOrders, setWaterOrders] = useState<WaterOrder[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [ordersData, fieldsData] = await Promise.all([getWaterOrders(), getFields()]);
        setWaterOrders(ordersData);
        setFields(fieldsData);
      } catch (err) {
        console.error("Failed to fetch initial data:", err);
        setError("Could not connect to the server. Please check your connection and try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUserChange = (userId: number) => {
    const user = USERS.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };
  
  // This function will be passed down to child components so they can refresh the data
  const refreshWaterOrders = async () => {
      try {
        const ordersData = await getWaterOrders();
        setWaterOrders(ordersData);
      } catch (err) {
          console.error("Failed to refresh water orders:", err);
          setError("Failed to update water orders. Please try again.");
      }
  };

  const DashboardComponent = useMemo(() => {
    if (isLoading) {
        return <div className="p-8 text-center">Loading application data...</div>;
    }
    if (error) {
        return <div className="p-8 text-center text-red-600 bg-red-50 rounded-md">{error}</div>;
    }

    switch (currentUser.role) {
      case UserRole.WaterManager:
        return <WaterManagerDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} />;
      case UserRole.WaterOffice:
        return <WaterOfficeDashboard waterOrders={waterOrders} refreshWaterOrders={refreshWaterOrders} />;
      case UserRole.DistrictOffice:
        // Fix: Pass the `waterOrders` state to the `DistrictOfficeDashboard` component to provide it with the necessary data.
        return <DistrictOfficeDashboard waterOrders={waterOrders} />;
      case UserRole.DitchRider:
        return <DitchRiderDashboard user={currentUser} waterOrders={waterOrders} fields={fields} refreshWaterOrders={refreshWaterOrders} />;
      default:
        return <div className="p-4">Invalid Role</div>;
    }
  }, [currentUser, waterOrders, fields, isLoading, error]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      <Header
        currentUser={currentUser}
        users={USERS}
        onUserChange={handleUserChange}
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {DashboardComponent}
      </main>
    </div>
  );
};

export default App;