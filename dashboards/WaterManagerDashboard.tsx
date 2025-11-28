
import React, { useState } from 'react';
import { User, Field, WaterOrder, WaterOrderStatus } from '../types';
import DashboardCard from '../components/DashboardCard';
import WaterOrderList from '../components/WaterOrderList';
import SeasonStatistics from '../components/SeasonStatistics';
import FieldDetailsModal from '../components/FieldDetailsModal';
import { WaterDropIcon, DocumentReportIcon, ChartBarIcon, QrCodeIcon, DocumentAddIcon } from '../components/icons';
import QRCodeModal from '../components/QRCodeModal';
import NewWaterOrderModal from '../components/NewWaterOrderModal';
import Scanner from '../components/Scanner';
import { createWaterOrder, updateWaterOrder } from '../services/api';

interface WaterManagerDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
  fields: Field[];
  refreshWaterOrders: () => Promise<void>;
}

const WaterManagerDashboard: React.FC<WaterManagerDashboardProps> = ({ user, waterOrders, fields, refreshWaterOrders }) => {
  const [selectedFieldForQR, setSelectedFieldForQR] = useState<Field | null>(null);
  const [selectedFieldDetails, setSelectedFieldDetails] = useState<Field | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const totalWaterUsed = fields.reduce((sum, field) => sum + field.waterUsed, 0);
  const totalAllocation = fields.reduce((sum, field) => sum + field.totalWaterAllocation, 0);
  const allocationUsedPercent = totalAllocation > 0 ? ((totalWaterUsed / totalAllocation) * 100).toFixed(1) : 0;

  const awaitingApprovalOrders = waterOrders.filter(o => o.status === WaterOrderStatus.AwaitingApproval);
  const myRecentOrders = waterOrders.filter(o => o.requester === user.name || awaitingApprovalOrders.some(aao => aao.id === o.id));

  const handleManualOrderCreate = async (formData: { fieldId: string; requestedAmount: number; deliveryStartDate: string; }) => {
    const field = fields.find(f => f.id === formData.fieldId);
    if (!field) {
        alert('Selected field not found.');
        return;
    }

    const newOrderData = {
        fieldId: field.id,
        fieldName: field.name,
        requester: user.name,
        status: WaterOrderStatus.Pending,
        deliveryStartDate: formData.deliveryStartDate,
        requestedAmount: formData.requestedAmount,
        lateral: field.lateral,
        tapNumber: field.tapNumber,
    };

    try {
        await createWaterOrder(newOrderData);
        await refreshWaterOrders();
        setIsNewOrderModalOpen(false);
        alert(`New water order for ${field.name} has been created and sent for approval.`);
    } catch (error: any) {
        // Display the direct message without "Error: Error:" prefix
        alert(error.message || error);
    }
  };

  const handleIrrigatorScan = async (data: string) => {
    setIsScannerOpen(false);
    try {
        const { action, fieldName } = JSON.parse(data);
        alert(`Scanned ${fieldName}: Request to ${action === 'start-delivery' ? 'START' : 'STOP'} water sent to Water Manager.`);
    } catch (e) {
        alert("Invalid QR Code");
    }
  };

  const handleSubmitToOffice = async (order: WaterOrder) => {
    const updatedOrder = { 
        ...order, 
        status: WaterOrderStatus.Pending, 
        requester: user.name 
    };

    try {
        await updateWaterOrder(order.id, updatedOrder);
        await refreshWaterOrders();
        alert(`Order ${order.id} has been submitted to the water office for final approval.`);
    } catch (error: any) {
        alert(`Error submitting order: ${error.message || error}`);
    }
  };

  const riderRequestActions = (order: WaterOrder) => (
    <button
      onClick={() => handleSubmitToOffice(order)}
      className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
    >
      Review & Submit
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Welcome, {user.name}</h2>
          <button 
                onClick={() => setIsScannerOpen(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                <QrCodeIcon className="-ml-1 mr-2 h-5 w-5" />
                Scan Field Tag
          </button>
      </div>
      
      <SeasonStatistics>
        <DashboardCard
          title="Total Water Used (Season)"
          value={`${totalWaterUsed.toFixed(1)} AF`}
          icon={<WaterDropIcon className="h-6 w-6 text-blue-600" />}
          color="bg-blue-100"
        />
        <DashboardCard
          title="Total Allocation"
          value={`${totalAllocation.toFixed(1)} AF`}
          icon={<DocumentReportIcon className="h-6 w-6 text-green-600" />}
          color="bg-green-100"
        />
        <DashboardCard
          title="Allocation Used"
          value={`${allocationUsedPercent}%`}
          icon={<ChartBarIcon className="h-6 w-6 text-yellow-600" />}
          color="bg-yellow-100"
        />
      </SeasonStatistics>
      
      {awaitingApprovalOrders.length > 0 && (
        <WaterOrderList
          orders={awaitingApprovalOrders}
          title="New Requests from Ditch Riders"
          actions={riderRequestActions}
        />
      )}

      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
        <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">My Fields</h3>
            <div className="flex items-center gap-2">
                 <button 
                    onClick={() => setIsNewOrderModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    <DocumentAddIcon className="-ml-1 mr-2 h-5 w-5" />
                    Create Water Order
                </button>
            </div>
        </div>
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Crop</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acres</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Water Used / Allocation (AF)</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {fields.map(field => {
                        const usagePercent = field.totalWaterAllocation > 0 ? (field.waterUsed / field.totalWaterAllocation) * 100 : 0;
                        const isRunning = waterOrders.some(o => o.fieldId === field.id && o.status === WaterOrderStatus.InProgress);
                        
                        return (
                        <tr 
                            key={field.id} 
                            className={`cursor-pointer transition-colors ${isRunning ? 'bg-blue-100 hover:bg-blue-200' : 'hover:bg-gray-50'}`}
                            onClick={() => setSelectedFieldDetails(field)}
                        >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                                {isRunning && <span className="mr-2 inline-block w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>}
                                {field.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{field.crop}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{field.acres}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{`${field.waterUsed} / ${field.totalWaterAllocation}`}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isRunning ? 'bg-blue-200 text-blue-800' : 'bg-gray-100 text-gray-600'}`}>
                                    {isRunning ? 'Running' : 'Idle'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedFieldForQR(field); }}
                                    className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                    title={`Generate QR Codes for ${field.name}`}
                                >
                                    <QrCodeIcon className="-ml-0.5 mr-2 h-4 w-4" />
                                    QR Codes
                                </button>
                            </td>
                        </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
      </div>

      <WaterOrderList orders={myRecentOrders} title="All Recent Water Orders" />

      {selectedFieldForQR && (
        <QRCodeModal
          field={selectedFieldForQR}
          onClose={() => setSelectedFieldForQR(null)}
        />
      )}
      
      {selectedFieldDetails && (
          <FieldDetailsModal
            field={selectedFieldDetails}
            orders={waterOrders}
            onClose={() => setSelectedFieldDetails(null)}
          />
      )}

      {isNewOrderModalOpen && (
          <NewWaterOrderModal
            fields={fields}
            onClose={() => setIsNewOrderModalOpen(false)}
            onOrderCreate={handleManualOrderCreate}
          />
      )}

      {isScannerOpen && (
          <Scanner 
            onScan={handleIrrigatorScan}
            onClose={() => setIsScannerOpen(false)}
          />
      )}
    </div>
  );
};

export default WaterManagerDashboard;
