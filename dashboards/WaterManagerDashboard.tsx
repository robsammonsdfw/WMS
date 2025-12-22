
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
}

type ViewMode = 'standard' | 'feed' | 'admin';

const WaterManagerDashboard: React.FC<WaterManagerDashboardProps> = ({ user, waterOrders, fields, refreshWaterOrders }) => {
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

  // Expanded Registry States
  const [newLatId, setNewLatId] = useState('');
  const [newLatName, setNewLatName] = useState('');
  const [newHGId, setNewHGId] = useState('');
  const [newHGLat, setNewHGLat] = useState('');
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
  const [newFieldHGs, setNewFieldHGs] = useState<string[]>([]);

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

  const handleAddLateral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLatId || !newLatName) return alert("Fill required lateral info.");
    try {
        await createLateral({ id: newLatId, name: newLatName });
        setNewLatId(''); setNewLatName('');
        await fetchAdminData();
        alert("Rider Channel registered.");
    } catch (err: any) { alert(err.message); }
  };

  const handleAddHeadgate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHGId || !newHGLat) return alert("Fill gate info.");
    try {
        await createHeadgate({ id: newHGId, name: newHGId, lateralId: newHGLat, tapNumber: newHGId });
        setNewHGId(''); setNewHGLat('');
        await fetchAdminData();
        alert("Headgate registered.");
    } catch (err: any) { alert(err.message); }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldId || !newFieldName) return alert("Field ID and Name required.");
    try {
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
            headgateIds: newFieldHGs
        });
        setNewFieldId(''); setNewFieldName(''); setNewCompName(''); setNewAddr(''); setNewPhone(''); setNewFieldCrop(''); setNewFieldAcres(''); setNewFieldOwner(''); setNewFieldAlloc(''); setNewFieldAllotment(''); setNewLatCoord(''); setNewLngCoord(''); setNewFieldHGs([]);
        await refreshWaterOrders(); 
        alert("Field Registry profile created.");
    } catch (err: any) { alert(err.message); }
  };

  const handleManualOrderCreate = async (formData: { fieldId: string; orderType: WaterOrderType; requestedAmount: number; deliveryStartDate: string; }) => {
    const field = fields.find(f => f.id === formData.fieldId);
    if (!field) return;

    // FK Safety: Resolve IDs or send NULL (undefined in JS) so backend handles the conversion
    const headgateId = field.headgateIds?.[0];
    const lateralId = (field as any).lateralId; // Provided by improved backend GET /fields

    const newOrderData = {
        fieldId: field.id,
        fieldName: field.name,
        requester: user.name,
        status: WaterOrderStatus.Pending,
        orderType: formData.orderType,
        deliveryStartDate: formData.deliveryStartDate,
        requestedAmount: formData.requestedAmount,
        lateralId: lateralId || undefined,
        headgateId: headgateId || undefined,
        tapNumber: field.tapNumber || '',
    };

    try {
        await createWaterOrder(newOrderData);
        await refreshWaterOrders();
        setIsNewOrderModalOpen(false);
    } catch (error: any) { 
        alert(error.message || "Failed to create order. Please check infrastructure mapping."); 
    }
  };

  const renderAdminView = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-300 pb-20">
        <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-900 p-8 text-white flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Infrastructure Command Center</h3>
                    <p className="text-gray-400 font-bold text-sm">Central registry for Riders, Gates, and Fields</p>
                </div>
                {isLoadingAdmin && <RefreshIcon className="h-6 w-6 animate-spin text-blue-400" />}
            </div>

            <div className="p-8 space-y-12">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-blue-600">
                            <UserGroupIcon className="h-6 w-6" />
                            <h4 className="text-lg font-black uppercase tracking-widest">1. Rider / Lateral Registry</h4>
                        </div>
                        <form onSubmit={handleAddLateral} className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50/50 p-6 rounded-3xl border border-blue-100 shadow-sm">
                            <input value={newLatId} onChange={e => setNewLatId(e.target.value)} placeholder="Rider ID (Lateral ID)" className="px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                            <input value={newLatName} onChange={e => setNewLatName(e.target.value)} placeholder="Lateral Name" className="px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                            <button type="submit" className="sm:col-span-2 bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">Register Rider Channel</button>
                        </form>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-green-600">
                            <RefreshIcon className="h-6 w-6" />
                            <h4 className="text-lg font-black uppercase tracking-widest">2. Headgate Registry</h4>
                        </div>
                        <form onSubmit={handleAddHeadgate} className="grid grid-cols-1 gap-4 bg-green-50/50 p-6 rounded-3xl border border-green-100 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input value={newHGId} onChange={e => setNewHGId(e.target.value)} placeholder="Gate ID (Populates Name/Tap)" className="px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-green-500 outline-none w-full" />
                                <select value={newHGLat} onChange={e => setNewHGLat(e.target.value)} className="px-4 py-3 border border-gray-200 rounded-xl bg-white font-bold focus:ring-2 focus:ring-green-500 outline-none w-full">
                                    <option value="">Select Rider/Lateral...</option>
                                    {laterals.map(l => <option key={l.id} value={l.id}>{l.name} ({l.id})</option>)}
                                </select>
                            </div>
                            <button type="submit" className="bg-green-600 text-white py-3 rounded-xl font-black uppercase text-xs hover:bg-green-700 transition-all shadow-lg shadow-green-100">Register Headgate</button>
                        </form>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-12">
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-indigo-600">
                            <ViewGridIcon className="h-6 w-6" />
                            <h4 className="text-lg font-black uppercase tracking-widest">3. Field Registry & Asset Mapping</h4>
                        </div>
                        <form onSubmit={handleAddField} className="space-y-8 bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm">
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

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Assign Headgate(s)</label>
                                <select multiple value={newFieldHGs} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewFieldHGs(Array.from(e.target.selectedOptions, (o: HTMLOptionElement) => o.value))} className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white font-bold h-[64px] overflow-y-auto focus:ring-2 focus:ring-indigo-500 outline-none">
                                    {headgates.map(h => <option key={h.id} value={h.id}>{h.id} (Tap {h.tapNumber})</option>)}
                                </select>
                            </div>

                            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-sm hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all">Register Field profile</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {fields.map(f => (
                <div key={f.id} onClick={() => setSelectedFieldDetails(f)} className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 hover:border-indigo-200 transition-colors cursor-pointer">
                    <p className="font-black text-gray-900 text-lg leading-tight">{f.name}</p>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1 tracking-widest">{f.companyName || f.owner || 'Farmer'}</p>
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
                    <button onClick={() => updateWaterOrder(order.id, { ...order, status: WaterOrderStatus.Pending }).then(refreshWaterOrders)} className="px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold uppercase">Submit to Office</button>
                )} />
            )}
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6">Asset Inventory</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Field</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Crop</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {fields.map(field => (
                                <tr key={field.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedFieldDetails(field)}>
                                    <td className="px-6 py-4 whitespace-nowrap font-black text-gray-900">{field.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{field.crop}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-black text-blue-600">{field.waterUsed} / {field.totalWaterAllocation} AF</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button onClick={(e) => { e.stopPropagation(); setSelectedFieldForQR(field); }} className="text-blue-600 hover:text-blue-800 font-bold uppercase text-[10px] flex items-center gap-1">
                                            <QrCodeIcon className="h-4 w-4" /> QR Codes
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <WaterOrderList orders={myRecentOrders} title="Command History" />
        </>
      )}

      {alertField && <WaterUsageAlertModal field={alertField} onClose={() => setAlertField(null)} onUpdate={refreshWaterOrders} />}
      {selectedFieldForQR && <QRCodeModal field={selectedFieldForQR} onClose={() => setSelectedFieldForQR(null)} />}
      {selectedFieldDetails && <FieldDetailsModal field={selectedFieldDetails} orders={waterOrders} onClose={() => setSelectedFieldDetails(null)} onCreateOrder={() => { setCreateOrderInitialFieldId(selectedFieldDetails.id); setIsNewOrderModalOpen(true); }} />}
      {isNewOrderModalOpen && <NewWaterOrderModal fields={fields} initialFieldId={createOrderInitialFieldId} onClose={() => setIsNewOrderModalOpen(false)} onOrderCreate={handleManualOrderCreate} />}
      {isScannerOpen && <Scanner onScan={handleIrrigatorScan} onClose={() => setIsScannerOpen(false)} />}
    </div>
  );
};

export default WaterManagerDashboard;
