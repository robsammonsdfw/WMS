
import React, { useState, useMemo } from 'react';
import { User, UserRole } from './types';
import { USERS } from './constants';
import Header from './components/Header';
import WaterManagerDashboard from './dashboards/WaterManagerDashboard';
import WaterOfficeDashboard from './dashboards/WaterOfficeDashboard';
import DistrictOfficeDashboard from './dashboards/DistrictOfficeDashboard';
import DitchRiderDashboard from './dashboards/DitchRiderDashboard';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User>(USERS[0]);

  const handleUserChange = (userId: number) => {
    const user = USERS.find(u => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  const DashboardComponent = useMemo(() => {
    switch (currentUser.role) {
      case UserRole.WaterManager:
        return <WaterManagerDashboard user={currentUser} />;
      case UserRole.WaterOffice:
        return <WaterOfficeDashboard user={currentUser} />;
      case UserRole.DistrictOffice:
        return <DistrictOfficeDashboard user={currentUser} />;
      case UserRole.DitchRider:
        return <DitchRiderDashboard user={currentUser} />;
      default:
        return <div className="p-4">Invalid Role</div>;
    }
  }, [currentUser]);

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
