
import React, { useState } from 'react';
import { User, Field, WaterOrder, WaterOrderStatus } from '../types';
import DashboardCard from '../components/DashboardCard';
import WaterOrderList from '../components/WaterOrderList';
import { WaterDropIcon, DocumentReportIcon, ChartBarIcon, QrCodeIcon, CameraIcon, DocumentAddIcon } from '../components/icons';
import QRCodeModal from '../components/QRCodeModal';
import WaterRequestUploader from '../components/WaterRequestUploader';
import NewWaterOrderModal from '../components/NewWaterOrderModal';
import { createWaterOrder, updateWaterOrder } from '../services/api';

interface WaterManagerDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
  fields: Field[];
  refreshWaterOrders: () => Promise<void>;
}

const WaterManagerDashboard: React.FC<WaterManagerDashboardProps> = ({ user, waterOrders, fields, refreshWaterOrders }) => {
  const [selectedFieldForQR, setSelectedFieldForQR] = useState<Field | null>(null);
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  const totalWaterUsed = fields.reduce((sum, field) => sum + field.waterUsed, 0);
  const totalAllocation = fields.reduce((sum, field) => sum + field.totalWaterAllocation, 0);
  const allocationUsedPercent = totalAllocation > 0 ? ((totalWaterUsed / totalAllocation) * 100).toFixed(1) : 0;

  const awaitingApprovalOrders = waterOrders.filter(o => o.status === WaterOrderStatus.AwaitingApproval);
  const myRecentOrders = waterOrders.filter(o => o.requester === user.name || awaitingApprovalOrders.some(aao => aao.id === o.id));

  const handleImageOrderCreated = async (extractedData: any) => {
    const field = fields.find(f => f.owner?.toLowerCase() === extractedData.owner?.toLowerCase());

    if (!field) {
        alert(`Could not find a field for owner "${extractedData.owner}". A new water order could not be created.`);
        setIsUploaderOpen(false);
        return;
    }

    const newOrderData = {
        serialNumber: extractedData.serialNumber,
        fieldId: field.id,
        fieldName: field.name,
        requester: user.name,
        status: WaterOrderStatus.Pending,
        deliveryStartDate: extractedData.deliveryStartDate,
        requestedAmount: extractedData.deliveryAmount,
        lateral: extractedData.lateral,
        tapNumber: extractedData.tapNumber,
    };

    try {
      await createWaterOrder(newOrderData);
      await refreshWaterOrders();
      setIsUploaderOpen(false);
      alert(`New water order created for ${field.name} and sent for approval.`);
    } catch (error) {
        alert(`Error creating water order: ${error}`);
    }
  };
  
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
    } catch (error) {
        alert(`Error creating water order: ${error}`);
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
    } catch (error) {
        alert(`Error submitting order: ${error}`);
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
      <h2 className="text-2xl font-bold text-gray-800">Welcome, {user.name}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DashboardCard
          title="Total Water Used (Season)"
          value={`${totalWaterUsed} AF`}
          icon={<WaterDropIcon className="h-6 w-6 text-blue-600" />}
          color="bg-blue-100"
        />
        <DashboardCard
          title="Total Allocation"
          value={`${totalAllocation} AF`}
          icon={<DocumentReportIcon className="h-6 w-6 text-green-600" />}
          color="bg-green-100"
        />
        <DashboardCard
          title="Allocation Used"
          value={`${allocationUsedPercent}%`}
          icon={<ChartBarIcon className="h-6 w-6 text-yellow-600" />}
          color="bg-yellow-100"
        />
      </div>
      
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
                 <button 
                    onClick={() => setIsUploaderOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                    <CameraIcon className="-ml-1 mr-2 h-5 w-5" />
                    Upload Card
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {fields.map(field => {
                        const usagePercent = field.totalWaterAllocation > 0 ? (field.waterUsed / field.totalWaterAllocation) * 100 : 0;
                        return (
                        <tr key={field.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{field.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{field.crop}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{field.acres}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{`${field.waterUsed} / ${field.totalWaterAllocation}`}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${usagePercent}%` }}></div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                    onClick={() => setSelectedFieldForQR(field)}
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
      {isUploaderOpen && (
          <WaterRequestUploader
            fields={fields}
            onClose={() => setIsUploaderOpen(false)}
            onOrderCreated={handleImageOrderCreated}
          />
      )}
      {isNewOrderModalOpen && (
          <NewWaterOrderModal
            fields={fields}
            onClose={() => setIsNewOrderModalOpen(false)}
            onOrderCreate={handleManualOrderCreate}
          />
      )}
    </div>
  );
};

export default WaterManagerDashboard;
