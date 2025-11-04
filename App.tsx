
import React, { useState, useMemo } from 'react';
import { User, UserRole, WaterOrder } from './types';
import { USERS, WATER_ORDERS } from './constants';
import Header from './components/Header';
import WaterManagerDashboard from './dashboards/WaterManagerDashboard';
import WaterOfficeDashboard from './dashboards/WaterOfficeDashboard';
import DistrictOfficeDashboard from './dashboards/DistrictOfficeDashboard';
import DitchRiderDashboard from './dashboards/DitchRiderDashboard';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(USERS[0]);
  const [waterOrders, setWaterOrders] = useState<WaterOrder[]>(WATER_ORDERS);

  const handleUserChange = (userId: number) => {
    const user = USERS.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  const DashboardComponent = useMemo(() => {
    switch (currentUser.role) {
      case UserRole.WaterManager:
        return <WaterManagerDashboard user={currentUser} waterOrders={waterOrders} setWaterOrders={setWaterOrders} />;
      case UserRole.WaterOffice:
        return <WaterOfficeDashboard user={currentUser} waterOrders={waterOrders} setWaterOrders={setWaterOrders} />;
      case UserRole.DistrictOffice:
        return <DistrictOfficeDashboard user={currentUser} />;
      case UserRole.DitchRider:
        return <DitchRiderDashboard user={currentUser} waterOrders={waterOrders} setWaterOrders={setWaterOrders} />;
      default:
        return <div className="p-4">Invalid Role</div>;
    }
  }, [currentUser, waterOrders]);

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