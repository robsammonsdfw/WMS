
import React, { useMemo, useState } from 'react';
import { User, WaterOrder, WaterOrderStatus } from '../types';
import { FIELDS } from '../constants';
import { QrCodeIcon } from '../components/icons';
import Scanner from '../components/Scanner';

interface DitchRiderDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
  setWaterOrders: React.Dispatch<React.SetStateAction<WaterOrder[]>>;
}

const DitchRiderDashboard: React.FC<DitchRiderDashboardProps> = ({ user, waterOrders, setWaterOrders }) => {
  const [isScanning, setIsScanning] = useState(false);
  
  const myOrders = waterOrders.filter(o => o.ditchRiderId === user.id && (o.status === WaterOrderStatus.Approved || o.status === WaterOrderStatus.InProgress));

  const ordersByLateral = useMemo(() => {
    return myOrders.reduce((acc, order) => {
      const lateral = order.lateral || 'Unassigned';
      if (!acc[lateral]) {
        acc[lateral] = [];
      }
      acc[lateral].push(order);
      return acc;
    }, {} as Record<string, WaterOrder[]>);
  }, [myOrders]);
  
  const handleScan = (data: string) => {
    setIsScanning(false);
    try {
      const { action, fieldId, fieldName } = JSON.parse(data);
      
      if (action === 'start-delivery') {
        const field = FIELDS.find(f => f.id === fieldId);
        if (!field) {
            alert(`Field with ID ${fieldId} not found.`);
            return;
        }

        const newOrder: WaterOrder = {
          id: `WO-${String(waterOrders.length + 1).padStart(3, '0')}`,
          fieldId,
          fieldName,
          requester: user.name, // Ditch rider is the initial requester
          status: WaterOrderStatus.AwaitingApproval,
          orderDate: new Date().toLocaleDateString('en-CA'),
          deliveryStartDate: new Date().toISOString(),
          requestedAmount: 0, // Manager needs to confirm/enter this
          ditchRiderId: user.id,
          lateral: field.lateral,
          tapNumber: field.tapNumber,
        };

        setWaterOrders(prevOrders => [newOrder, ...prevOrders]);
        alert(`Started water delivery for ${fieldName}. A request has been sent to the water manager for approval.`);

      } else if (action === 'end-delivery') {
        const orderIndex = waterOrders.findIndex(o => 
          o.fieldId === fieldId && 
          o.status === WaterOrderStatus.InProgress &&
          o.ditchRiderId === user.id
        );

        if (orderIndex !== -1) {
          const updatedOrders = [...waterOrders];
          updatedOrders[orderIndex] = { ...updatedOrders[orderIndex], status: WaterOrderStatus.Completed };
          setWaterOrders(updatedOrders);
          alert(`Ended water delivery for ${fieldName}.`);
        } else {
          alert(`No "In Progress" order for "${fieldName}" was found for you.`);
        }
      } else {
        alert('Invalid QR code action.');
      }

    } catch (e) {
      alert('Error scanning QR code. Invalid data format.');
      console.error(e);
    }
  };

  const OrderCard: React.FC<{order: WaterOrder}> = ({ order }) => (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex justify-between items-start">
            <div>
                <p className="font-bold text-gray-800">{order.fieldName}</p>
                <p className="text-sm text-gray-500">Order ID: {order.id}</p>
            </div>
            {order.status === WaterOrderStatus.InProgress && 
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 animate-pulse">In Progress</span>
            }
            {order.status === WaterOrderStatus.Approved && 
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Ready to Start</span>
            }
        </div>
        <p className="text-gray-700">Requested Amount: <span className="font-semibold">{order.requestedAmount} AF</span></p>
        
        <p className="text-sm text-gray-600">Use QR code at headgate to start or stop delivery.</p>

    </div>
  );


  return (
    <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">Ditch Rider Tasks</h2>
            <p className="text-gray-600">Welcome, {user.name}</p>
        </div>
      
      {Object.keys(ordersByLateral).map((lateral) => (
        <div key={lateral}>
          <h3 className="text-xl font-semibold text-gray-700 mb-2 px-1">Lateral {lateral}</h3>
          <div className="space-y-4">
            {ordersByLateral[lateral].map(order => <OrderCard key={order.id} order={order} />)}
          </div>
        </div>
      ))}

      {myOrders.length === 0 && (
        <div className="text-center py-10 bg-white rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-800">No active orders assigned.</h3>
            <p className="text-gray-500">Check back later for new tasks.</p>
        </div>
      )}

      <div className="fixed bottom-6 right-6">
        <button 
          onClick={() => setIsScanning(true)}
          className="flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transform transition-transform hover:scale-110"
          aria-label="Scan QR Code"
        >
          <QrCodeIcon className="h-8 w-8" />
        </button>
      </div>

      {isScanning && (
        <Scanner
          onScan={handleScan}
          onClose={() => setIsScanning(false)}
        />
      )}
    </div>
  );
};

export default DitchRiderDashboard;
