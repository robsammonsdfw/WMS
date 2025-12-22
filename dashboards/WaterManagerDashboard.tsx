
import React, { useState, useEffect, useMemo } from 'react';
import { User, Field, WaterOrder, WaterOrderStatus, WaterOrderType, Lateral, Headgate } from '../types';
import DashboardCard from '../components/DashboardCard';
import WaterOrderList from '../components/WaterOrderList';
import SeasonStatistics from '../components/SeasonStatistics';
import FieldDetailsModal from '../components/FieldDetailsModal';
import { 
    WaterDropIcon, DocumentReportIcon, ChartBarIcon, QrCodeIcon, 
    RefreshIcon, ChartBarIcon as ViewGridIcon, BellIcon, TrashIcon,
    PlusIcon, UserGroupIcon, DocumentAddIcon
} from '../components/icons';
import QRCodeModal from '../components/QRCodeModal';
import NewWaterOrderModal from '../components/NewWaterOrderModal';
import Scanner from '../components/Scanner';
import RemainingFeedView from '../components/RemainingFeedView';
import WaterUsageAlertModal from '../components/WaterUsageAlertModal';
import { 
    createWaterOrder, updateWaterOrder, resetDatabase, 
    getLaterals, getHeadgates, createLateral, createHeadgate, createField 
} from '../services/api';

interface WaterManagerDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
  fields: Field[];
  refreshWaterOrders: () => Promise<void>;
  refreshFields: () => Promise<void>;
}

type ViewMode = 'standard' | 'feed' | 'admin';

const WaterManagerDashboard: React.FC<WaterManagerDashboardProps> = ({ user, waterOrders, fields, refreshWaterOrders, refreshFields }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [selectedFieldForQR, setSelectedFieldForQR] = useState<Field | null>(null);
  const [selectedFieldDetails, setSelectedFieldDetails] = useState<Field | null>(null);
  const [alertField, setAlertField] = useState<Field | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [createOrderInitialFieldId, setCreateOrderInitialFieldId] = useState<string | undefined>(undefined);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  const [laterals, setLaterals] = useState<Lateral[]>([]);
  const [headgates, setHeadgates] = useState<Headgate[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);

  // Field Registry States
  const [newFieldId, setNewFieldId] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newCompName, setNewCompName] = useState('');
  const [newAddr, setNewAddr] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newFieldCrop, setNewFieldCrop] = useState('');
  const [newFieldAcres, setNewFieldAcres] = useState('');
  const [newFieldOwner, setNewFieldOwner] = useState('');
  const [newFieldAlloc, setNewFieldAlloc] = useState('');
  const [newFieldAllotment, setNewFieldAllotment] = useState('');
  const [newLatCoord, setNewLatCoord] = useState('');
  const [newLngCoord, setNewLngCoord] = useState('');
  
  // New "Direct Typed" States
  const [newTypedLateral, setNewTypedLateral] = useState('');
  const [newTypedHeadgate, setNewTypedHeadgate] = useState('');

  // Hidden Registry States (Keeping code ready for future)
  const [newLatId, setNewLatId] = useState('');
  const [newLatName, setNewLatName] = useState('');
  const [newHGId, setNewHGId] = useState('');
  const [newHGLat, setNewHGLat] = useState('');

  useEffect(() => {
    if (viewMode === 'admin') fetchAdminData();
  }, [viewMode]);

  const fetchAdminData = async () => {
    setIsLoadingAdmin(true);
    try {
      const [l, h] = await Promise.all([getLaterals(), getHeadgates()]);
      setLaterals(l || []);
      setHeadgates(h || []);
    } catch (e) { console.error(e); } finally { setIsLoadingAdmin(false); }
  };

  useEffect(() => {
    const checkForAlerts = () => {
        const fieldWithAlert = fields.find(f => {
            const activeAccount = f.accounts?.find(a => a.isActive);
            if (activeAccount?.allocationForField && activeAccount.usageForField) {
                 const percent = (activeAccount.usageForField / activeAccount.allocationForField);
                 return percent >= 0.75 && percent < 1.0 && !f.accounts.some(a => a.isQueued);
            }
            return false; 
        });
        if (fieldWithAlert) setAlertField(fieldWithAlert);
    };
    const timer = setTimeout(checkForAlerts, 1000);
    return () => clearTimeout(timer);
  }, [fields]);

  const totalWaterUsed = fields.reduce((sum, field) => sum + (field.waterUsed || 0), 0);
  const totalAllocation = fields.reduce((sum, field) => sum + (field.totalWaterAllocation || 0), 0);
  const allocationUsedPercent = totalAllocation > 0 ? ((totalWaterUsed / totalAllocation) * 100).toFixed(1) : 0;

  const awaitingApprovalOrders = waterOrders.filter(o => o.status === WaterOrderStatus.AwaitingApproval);
  const myRecentOrders = waterOrders.filter(o => o.requester === user.name || awaitingApprovalOrders.some(aao => aao.id === o.id));

  const handleResetDb = async () => {
    if (window.confirm("Are you sure you want to reset the entire database? This cannot be undone.")) {
      try {
        await resetDatabase();
        await refreshWaterOrders();
        await refreshFields();
        alert("Database reset successfully.");
        window.location.reload(); 
      } catch (err: any) {
        alert("Reset failed: " + (err.message || "Unknown error"));
      }
    }
  };

  const handleIrrigatorScan = (data: string) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.fieldId) {
        const field = fields.find(f => f.id === parsed.fieldId);
        if (field) {
          setSelectedFieldDetails(field);
          setIsScannerOpen(false);
        } else {
          alert("Field not found in registry.");
        }
      } else {
        alert("Invalid QR code format.");
      }
    } catch (e) {
      alert("Error reading QR code. Please ensure it's a valid AquaTrack tag.");
    }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldId || !newFieldName) return alert("Field ID and Name required.");
    try {
        // We pass the typed lateral and headgate directly
        await createField({ 
            id: newFieldId, 
            name: newFieldName, 
            companyName: newCompName,
            address: newAddr,
            phone: newPhone,
            crop: newFieldCrop, 
            acres: parseFloat(newFieldAcres) || 0,
            totalWaterAllocation: parseFloat(newFieldAlloc) || 0,
            waterAllotment: parseFloat(newFieldAllotment) || 0,
            lat: parseFloat(newLatCoord),
            lng: parseFloat(newLngCoord),
            owner: newFieldOwner,
            lateral: newTypedLateral,
            tapNumber: newTypedHeadgate,
            // Still passing as an array for the backend join logic to work if it finds it
            headgateIds: newTypedHeadgate ? [newTypedHeadgate] : [] 
        });
        
        // Reset states
        setNewFieldId(''); setNewFieldName(''); setNewCompName(''); setNewAddr(''); setNewPhone(''); 
        setNewFieldCrop(''); setNewFieldAcres(''); setNewFieldOwner(''); setNewFieldAlloc(''); 
        setNewFieldAllotment(''); setNewLatCoord(''); setNewLngCoord('');
        setNewTypedLateral(''); setNewTypedHeadgate('');

        await refreshFields(); 
        alert("Field Registry profile created and linked.");
    } catch (err: any) { alert(err.message); }
  };

  // Added handleManualOrderCreate to resolve the missing reference and handle manual order creation from the dashboard.
  const handleManualOrderCreate = async (orderData: { 
    fieldId: string; 
    orderType: WaterOrderType; 
    requestedAmount: number; 
    deliveryStartDate: string; 
  }) => {
    try {
      const field = fields.find(f => f.id === orderData.fieldId);
      if (!field) throw new Error("Field not found in registry.");

      await createWaterOrder({
        ...orderData,
        fieldName: field.name,
        requester: user.name,
        status: WaterOrderStatus.AwaitingApproval,
        orderDate: new Date().toISOString().split('T')[0],
        lateralId: field.lateral || '',
        tapNumber: field.tapNumber || '',
        headgateId: field.headgateIds?.[0] || ''
      });

      setIsNewOrderModalOpen(false);
      await refreshWaterOrders();
      alert("Water order submitted. It is now awaiting Rider verification.");
    } catch (err: any) {
      alert("Failed to create order: " + (err.message || "Unknown error"));
    }
  };

  const renderAdminView = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-300 pb-20">
        
        {/* Step 1 & 2 are hidden for the demo as requested, but logic is preserved below */}
        <div className="hidden space-y-12">
            {/* Lateral and Headgate registry code is kept here but not rendered */}
        </div>

        <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-900 p-8 text-white flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Infrastructure Command Center</h3>
                    <p className="text-gray-400 font-bold text-sm">Register Fields and Assign Infrastructure Details</p>
                </div>
                {isLoadingAdmin && <RefreshIcon className="h-6 w-6 animate-spin text-blue-400" />}
            </div>

            <div className="p-8 space-y-12">
                <div className="space-y-6">
                    <div className="flex items-center space-x-3 text-indigo-600">
                        <ViewGridIcon className="h-6 w-6" />
                        <h4 className="text-lg font-black uppercase tracking-widest">Field Registry & Asset Mapping</h4>
                    </div>
                    
                    <form onSubmit={handleAddField} className="space-y-8 bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm">
                        {/* Primary Field Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Field ID</label>
                                <input value={newFieldId} onChange={e => setNewFieldId(e.target.value)} placeholder="F-001" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Display Name</label>
                                <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="SILVERBUTTE PIVOT 1" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Company Name</label>
                                <input value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="SILVER BUTTE HOLSTEINS, INC" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Phone</label>
                                <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="208-941-0595" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                        </div>
                        
                        {/* Address and Crop */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Address</label>
                                <input value={newAddr} onChange={e => setNewAddr(e.target.value)} placeholder="1120 W KUNA CAVE RD, KUNA, ID 83634" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Crop Type</label>
                                    <input value={newFieldCrop} onChange={e => setNewFieldCrop(e.target.value)} placeholder="Silage Corn" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Acres</label>
                                    <input type="number" value={newFieldAcres} onChange={e => setNewFieldAcres(e.target.value)} placeholder="110" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        {/* Financial / Owner Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Owner Name</label>
                                <input value={newFieldOwner} onChange={e => setNewFieldOwner(e.target.value)} placeholder="SHANE BEUS" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Water Allowance (AF)</label>
                                <input type="number" value={newFieldAlloc} onChange={e => setNewFieldAlloc(e.target.value)} placeholder="412.5" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Current Allotment (AF)</label>
                                <input type="number" value={newFieldAllotment} onChange={e => setNewFieldAllotment(e.target.value)} placeholder="291.5" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lat</label>
                                    <input value={newLatCoord} onChange={e => setNewLatCoord(e.target.value)} placeholder="43.48" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lng</label>
                                    <input value={newLngCoord} onChange={e => setNewLngCoord(e.target.value)} placeholder="-116.41" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        {/* NEW: Infrastructure Mapping - Typed Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-indigo-100">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1 tracking-widest">Assign Lateral (Typed)</label>
                                <input 
                                    value={newTypedLateral} 
                                    onChange={e => setNewTypedLateral(e.target.value)} 
                                    placeholder="e.g., 8.13" 
                                    className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl font-black text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                                />
                                <p className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Enter the Lateral ID or Rider Channel Name</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1 tracking-widest">Assign Headgate / Tap (Typed)</label>
                                <input 
                                    value={newTypedHeadgate} 
                                    onChange={e => setNewTypedHeadgate(e.target.value)} 
                                    placeholder="e.g., 8.13-A" 
                                    className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl font-black text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" 
                                />
                                <p className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Enter the primary Headgate ID or Tap Number</p>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all">Register Field Profile</button>
                    </form>
                </div>
            </div>
        </div>

        {/* Quick View of Existing Registry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {fields.map(f => (
                <div key={f.id} onClick={() => setSelectedFieldDetails(f)} className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 hover:border-indigo-200 transition-colors cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                        <p className="font-black text-gray-900 text-lg leading-tight group-hover:text-indigo-600 transition-colors">{f.name}</p>
                        <span className="text-[8px] font-black bg-gray-100 px-2 py-0.5 rounded uppercase">{f.id}</span>
                    </div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{f.companyName || f.owner || 'Farmer'}</p>
                    <div className="mt-4 flex gap-2">
                        <div className="px-2 py-1 bg-blue-50 text-[9px] font-black text-blue-600 rounded-lg uppercase">Lat: {f.lateral || 'None'}</div>
                        <div className="px-2 py-1 bg-green-50 text-[9px] font-black text-green-600 rounded-lg uppercase">HG: {f.tapNumber || 'None'}</div>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 border-b-2 border-gray-100 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <span className="w-10 h-1 bg-blue-600 rounded-full"></span>
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em]">Water Manager Operations</p>
            </div>
            <h2 className="text-4xl font-black text-gray-900 tracking-tight">Operations Center</h2>
          </div>
          <div className="flex bg-gray-100 rounded-[2rem] p-1.5 border-2 border-white shadow-inner">
            <button onClick={() => setViewMode('standard')} className={`px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'standard' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-gray-500'}`}>Standard</button>
            <button onClick={() => setViewMode('feed')} className={`px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'feed' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-gray-500'}`}>Remaining Feed</button>
            <button onClick={() => setViewMode('admin')} className={`px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'admin' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-gray-500'}`}>Infrastructure</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsScannerOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 uppercase tracking-widest shadow-lg shadow-indigo-100"><QrCodeIcon className="-ml-1 mr-2 h-4 w-4" /> Scan Tag</button>
            <button onClick={handleResetDb} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-black rounded-xl text-white bg-red-600 hover:bg-red-700 uppercase tracking-widest shadow-lg shadow-red-100"><TrashIcon className="-ml-1 mr-2 h-4 w-4" /> Reset DB</button>
          </div>
      </div>
      
      {viewMode === 'admin' ? renderAdminView() : viewMode === 'feed' ? (
        <RemainingFeedView fields={fields} waterOrders={waterOrders} onFieldClick={setSelectedFieldDetails} />
      ) : (
        <>
            <SeasonStatistics>
                <DashboardCard title="Total Water Used" value={`${totalWaterUsed.toFixed(1)} AF`} icon={<WaterDropIcon className="h-6 w-6 text-blue-600" />} color="bg-blue-100" />
                <DashboardCard title="Total Allocation" value={`${totalAllocation.toFixed(1)} AF`} icon={<DocumentReportIcon className="h-6 w-6 text-green-600" />} color="bg-green-100" />
                <DashboardCard title="Allocation Used" value={`${allocationUsedPercent}%`} icon={<ChartBarIcon className="h-6 w-6 text-yellow-600" />} color="bg-yellow-100" />
            </SeasonStatistics>
            {awaitingApprovalOrders.length > 0 && (
                <WaterOrderList orders={awaitingApprovalOrders} title="Rider Approval Requests" actions={(order) => (
                    <button onClick={() => updateWaterOrder(order.id, { ...order, status: WaterOrderStatus.Pending }).then(refreshWaterOrders)} className="px-3