
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
  
  // Infrastructure state
  const [laterals, setLaterals] = useState<Lateral[]>([]);
  const [headgates, setHeadgates] = useState<Headgate[]>([]);
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);

  // Infrastructure Form states
  const [newLatId, setNewLatId] = useState('');
  const [newLatName, setNewLatName] = useState('');
  const [newHGId, setNewHGId] = useState('');
  const [newHGName, setNewHGName] = useState('');
  const [newHGLat, setNewHGLat] = useState('');
  const [newHGTap, setNewHGTap] = useState('');
  const [newFieldId, setNewFieldId] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldCrop, setNewFieldCrop] = useState('');
  const [newFieldAcres, setNewFieldAcres] = useState('');
  const [newFieldOwner, setNewFieldOwner] = useState('');
  const [newFieldLoc, setNewFieldLoc] = useState('');
  const [newFieldAlloc, setNewFieldAlloc] = useState('');
  const [newFieldHGs, setNewFieldHGs] = useState<string[]>([]);

  // Fetch admin data when switching to admin view
  useEffect(() => {
    if (viewMode === 'admin') {
      fetchAdminData();
    }
  }, [viewMode]);

  const fetchAdminData = async () => {
    setIsLoadingAdmin(true);
    try {
      const [l, h] = await Promise.all([getLaterals(), getHeadgates()]);
      setLaterals(l);
      setHeadgates(h);
    } catch (e) {
      console.error("Failed to load admin infrastructure data", e);
    } finally {
      setIsLoadingAdmin(false);
    }
  };

  // Check for alerts on fields whenever 'fields' data updates
  useEffect(() => {
    const checkForAlerts = () => {
        const fieldWithAlert = fields.find(f => {
            const activeAccount = f.accounts?.find(a => a.isActive);
            if (activeAccount && activeAccount.allocationForField && activeAccount.usageForField) {
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

  // Infrastructure Handlers
  const handleAddLateral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLatId || !newLatName) return;
    try {
        await createLateral({ id: newLatId, name: newLatName });
        setNewLatId(''); setNewLatName('');
        await fetchAdminData();
        alert("Lateral registered successfully.");
    } catch (err: any) { alert(err.message); }
  };

  const handleAddHeadgate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHGId || !newHGName || !newHGLat) {
        alert("Select a lateral for this headgate.");
        return;
    }
    try {
        await createHeadgate({ id: newHGId, name: newHGName, lateralId: newHGLat, tapNumber: newHGTap });
        setNewHGId(''); setNewHGName(''); setNewHGLat(''); setNewHGTap('');
        await fetchAdminData();
        alert("Headgate registered successfully.");
    } catch (err: any) { alert(err.message); }
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldId || !newFieldName) return;
    try {
        await createField({ 
            id: newFieldId, 
            name: newFieldName, 
            crop: newFieldCrop, 
            acres: parseFloat(newFieldAcres) || 0,
            location: newFieldLoc,
            totalWaterAllocation: parseFloat(newFieldAlloc) || 0,
            owner: newFieldOwner,
            headgateIds: newFieldHGs
        });
        setNewFieldId(''); setNewFieldName(''); setNewFieldCrop(''); setNewFieldAcres(''); setNewFieldOwner(''); setNewFieldLoc(''); setNewFieldAlloc(''); setNewFieldHGs([]);
        await refreshWaterOrders(); // This refreshes fields as well in App context
        alert("Field registered and linked successfully.");
    } catch (err: any) { alert(err.message); }
  };

  const handleManualOrderCreate = async (formData: { fieldId: string; orderType: WaterOrderType; requestedAmount: number; deliveryStartDate: string; }) => {
    const field = fields.find(f => f.id === formData.fieldId);
    if (!field) return;

    const newOrderData = {
        fieldId: field.id,
        fieldName: field.name,
        requester: user.name,
        status: WaterOrderStatus.Pending,
        orderType: formData.orderType,
        deliveryStartDate: formData.deliveryStartDate,
        requestedAmount: formData.requestedAmount,
        lateralId: field.lateral || '',
        headgateId: field.headgateIds?.[0] || '',
        tapNumber: field.tapNumber || '',
    };

    try {
        await createWaterOrder(newOrderData);
        await refreshWaterOrders();
        setIsNewOrderModalOpen(false);
        alert(`New order created.`);
    } catch (error: any) { alert(error.message || error); }
  };

  const handleIrrigatorScan = async (data: string) => {
    setIsScannerOpen(false);
    try {
        const { action, fieldName } = JSON.parse(data);
        alert(`Scanned ${fieldName}: Request sent.`);
    } catch (e) { alert("Invalid QR Code"); }
  };

  const handleResetDb = async () => {
      if(confirm("Reset entire database?")) {
          try {
              await resetDatabase();
              window.location.reload();
          } catch(e: any) { alert(e.message); }
      }
  };

  const renderAdminView = () => (
    <div className="space-y-12 animate-in slide-in-from-bottom-6 duration-300 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Lateral Manager */}
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                <div className="flex items-center mb-8">
                    <div className="bg-blue-600 p-3 rounded-xl mr-4 text-white"><DocumentReportIcon className="h-6 w-6"/></div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">1. Lateral Registry</h3>
                </div>
                <form onSubmit={handleAddLateral} className="space-y-4 mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input value={newLatId} onChange={e => setNewLatId(e.target.value)} placeholder="Lateral ID (e.g. L-A)" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                        <input value={newLatName} onChange={e => setNewLatName(e.target.value)} placeholder="Lateral Name" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                    </div>
                    <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-xs hover:bg-blue-700">Add Lateral</button>
                </form>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {laterals.map(l => (
                        <div key={l.id} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-200">
                            <span className="font-black text-gray-800">{l.id}: {l.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Headgate Manager */}
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                <div className="flex items-center mb-8">
                    <div className="bg-green-600 p-3 rounded-xl mr-4 text-white"><RefreshIcon className="h-6 w-6"/></div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">2. Headgate Registry</h3>
                </div>
                <form onSubmit={handleAddHeadgate} className="space-y-4 mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <input value={newHGId} onChange={e => setNewHGId(e.target.value)} placeholder="Gate ID" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                        <input value={newHGName} onChange={e => setNewHGName(e.target.value)} placeholder="Gate Name" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <select value={newHGLat} onChange={e => setNewHGLat(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white font-bold">
                            <option value="">Select Lateral...</option>
                            {laterals.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                        <input value={newHGTap} onChange={e => setNewHGTap(e.target.value)} placeholder="Tap # Reference" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                    </div>
                    <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-xl font-black uppercase text-xs hover:bg-green-700">Add Headgate</button>
                </form>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {headgates.map(h => (
                        <div key={h.id} className="p-4 bg-white rounded-xl border border-gray-200 flex justify-between">
                            <span className="font-black text-gray-800">{h.name} ({h.id})</span>
                            <span className="text-[10px] font-bold text-gray-400 uppercase">Tap {h.tapNumber}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Field Manager */}
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
            <div className="flex items-center mb-8">
                <div className="bg-indigo-600 p-3 rounded-xl mr-4 text-white"><UserGroupIcon className="h-6 w-6"/></div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">3. Field Registry & Infrastructure Link</h3>
            </div>
            <form onSubmit={handleAddField} className="space-y-6 bg-gray-50 p-8 rounded-3xl border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <input value={newFieldId} onChange={e => setNewFieldId(e.target.value)} placeholder="Field ID (F-001)" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                    <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Field Name" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                    <input value={newFieldCrop} onChange={e => setNewFieldCrop(e.target.value)} placeholder="Primary Crop" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <input type="number" value={newFieldAcres} onChange={e => setNewFieldAcres(e.target.value)} placeholder="Acres" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                    <input value={newFieldOwner} onChange={e => setNewFieldOwner(e.target.value)} placeholder="Owner Name" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                    <input type="number" value={newFieldAlloc} onChange={e => setNewFieldAlloc(e.target.value)} placeholder="Season Allocation (AF)" className="w-full px-4 py-3 border border-gray-300 rounded-xl font-bold" />
                    {/* Fix: Explicitly type the option element in Array.from to resolve 'unknown' type error for multiple select value extraction */}
                    <select multiple value={newFieldHGs} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewFieldHGs(Array.from(e.target.selectedOptions, (o: HTMLOptionElement) => o.value))} className="w-full px-4 py-2 border border-gray-300 rounded-xl bg-white font-bold h-[48px]">
                        {headgates.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                    </select>
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-sm hover:bg-indigo-700">Register Field Assets</button>
            </form>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {fields.map(f => (
                    <div key={f.id} className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
                        <p className="font-black text-gray-900">{f.name}</p>
                        <p className="text-[10px] font-bold text-indigo-600 uppercase">{f.owner || 'Unknown Owner'}</p>
                    </div>
                ))}
            </div>
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
            <button 
                onClick={() => setViewMode('standard')}
                className={`px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'standard' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-gray-500'}`}
            >
                Standard
            </button>
            <button 
                onClick={() => setViewMode('feed')}
                className={`px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'feed' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-gray-500'}`}
            >
                Remaining Feed
            </button>
            <button 
                onClick={() => setViewMode('admin')}
                className={`px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'admin' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-gray-500'}`}
            >
                Infrastructure
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setIsScannerOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 uppercase tracking-widest shadow-lg shadow-indigo-100">
                <QrCodeIcon className="-ml-1 mr-2 h-4 w-4" /> Scan Tag
            </button>
            <button onClick={handleResetDb} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-black rounded-xl text-white bg-red-600 hover:bg-red-700 uppercase tracking-widest shadow-lg shadow-red-100">
                <TrashIcon className="-ml-1 mr-2 h-4 w-4" /> Reset DB
            </button>
          </div>
      </div>
      
      {viewMode === 'admin' ? renderAdminView() : viewMode === 'feed' ? (
        <RemainingFeedView 
          fields={fields} 
          waterOrders={waterOrders} 
          onFieldClick={setSelectedFieldDetails}
        />
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

      {/* MODALS */}
      {alertField && <WaterUsageAlertModal field={alertField} onClose={() => setAlertField(null)} onUpdate={refreshWaterOrders} />}
      {selectedFieldForQR && <QRCodeModal field={selectedFieldForQR} onClose={() => setSelectedFieldForQR(null)} />}
      {selectedFieldDetails && <FieldDetailsModal field={selectedFieldDetails} orders={waterOrders} onClose={() => setSelectedFieldDetails(null)} onCreateOrder={() => { setCreateOrderInitialFieldId(selectedFieldDetails.id); setIsNewOrderModalOpen(true); }} />}
      {isNewOrderModalOpen && <NewWaterOrderModal fields={fields} initialFieldId={createOrderInitialFieldId} onClose={() => setIsNewOrderModalOpen(false)} onOrderCreate={handleManualOrderCreate} />}
      {isScannerOpen && <Scanner onScan={handleIrrigatorScan} onClose={() => setIsScannerOpen(false)} />}
    </div>
  );
};

export default WaterManagerDashboard;
