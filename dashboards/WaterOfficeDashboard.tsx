
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { WaterOrder, WaterOrderStatus, User, Lateral, Headgate, UserRole, WaterOrderType, Field } from '../types';
import WaterOrderList from '../components/WaterOrderList';
import DashboardCard from '../components/DashboardCard';
import { 
    ClockIcon, CheckCircleIcon, RefreshIcon, WaterDropIcon, 
    DocumentReportIcon, UserGroupIcon, ChevronDownIcon, 
    XCircleIcon, PlusIcon, TrashIcon, ChartBarIcon as ViewGridIcon
} from '../components/icons';
import { 
    updateWaterOrder, getLaterals, getHeadgates, getFields,
    createLateral, createHeadgate, createField, deleteField, resetDatabase 
} from '../services/api';
import { USERS } from '../constants';

interface WaterOfficeDashboardProps {
  waterOrders: WaterOrder[];
  refreshWaterOrders: () => Promise<void>;
  refreshFields: () => Promise<void>;
}

type Tab = 'overview' | 'riders' | 'admin';

const WaterOfficeDashboard: React.FC<WaterOfficeDashboardProps> = ({ waterOrders, refreshWaterOrders, refreshFields }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedRider, setSelectedRider] = useState<User | null>(null);
  const [laterals, setLaterals] = useState<Lateral[]>([]);
  const [headgates, setHeadgates] = useState<Headgate[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Admin form state: Laterals
  const [newLatName, setNewLatName] = useState('');

  // Admin form state: Headgates
  const [newHGId, setNewHGId] = useState('');
  const [newHGLat, setNewHGLat] = useState('');

  // Admin form state: Fields
  const [newFieldId, setNewFieldId] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldCrop, setNewFieldCrop] = useState('');
  const [newFieldAcresValue, setNewFieldAcresValue] = useState('');
  const [newFieldOwner, setNewFieldOwner] = useState('');
  const [newFieldLoc, setNewFieldLoc] = useState('');
  const [newFieldAlloc, setNewFieldAlloc] = useState('');
  const [newFieldHGs, setNewFieldHGs] = useState<string[]>([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
        const [l, h, f] = await Promise.all([getLaterals(), getHeadgates(), getFields()]);
        setLaterals(l || []);
        setHeadgates(h || []);
        setFields(f || []);
    } catch (e) {
        console.error("Failed to load admin data", e);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const ditchRiders = useMemo(() => USERS.filter(u => u.role === UserRole.DitchRider), []);
  const featuredRiders = ditchRiders.slice(0, 3);

  const lateralReportData = useMemo(() => {
    const data: Record<string, { name: string, inches: number, count: number }> = {};
    laterals.forEach(l => {
        data[l.id] = { name: l.name, inches: 0, count: 0 };
    });
    waterOrders.forEach(o => {
        if (data[o.lateralId]) {
            data[o.lateralId].inches += (o.requestedAmount || 0) * 25;
            data[o.lateralId].count += 1;
        }
    });
    return Object.values(data);
  }, [waterOrders, laterals]);

  // Combined List of Laterals (DB + Legacy from Fields) for Dropdown
  const combinedLateralOptions = useMemo(() => {
    const options = [...laterals]; // Start with DB laterals
    
    // Scan existing fields for any "lateral" strings that aren't in the DB
    const existingIds = new Set(laterals.map(l => l.id.toLowerCase()));
    const existingNames = new Set(laterals.map(l => l.name.toLowerCase()));

    fields.forEach(f => {
        if (f.lateral) {
            const latStr = f.lateral.trim();
            const latLower = latStr.toLowerCase();
            if (!existingIds.has(latLower) && !existingNames.has(latLower)) {
                // Add this legacy lateral to options temporarily
                options.push({ id: latStr, name: latStr });
                existingIds.add(latLower);
            }
        }
    });
    return options;
  }, [laterals, fields]);

  const handleUpdateStatus = async (orderId: string, status: WaterOrderStatus) => {
    try {
        await updateWaterOrder(orderId, { status });
        await refreshWaterOrders();
    } catch (error) {
        alert(`Failed to update order: ${error}`);
    }
  };

  const handleAddLateral = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newLatName) return alert("Please enter a Lateral Name.");

      // Auto-generate ID based on Name (First 3 chars + sequential number)
      // e.g. "VanDoozer" -> "VAN-01". If "VAN-01" exists, try "VAN-02"
      const prefix = newLatName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase() || "LAT";
      let counter = 1;
      let generatedId = `${prefix}-${counter.toString().padStart(2, '0')}`;
      
      const existingIds = laterals.map(l => l.id);
      while (existingIds.includes(generatedId)) {
          counter++;
          generatedId = `${prefix}-${counter.toString().padStart(2, '0')}`;
      }

      try {
          await createLateral({ id: generatedId, name: newLatName });
          setNewLatName('');
          await fetchData();
          await refreshFields();
          alert(`Lateral registered successfully! Assigned ID: ${generatedId}`);
      } catch (err: any) { alert(err.message); }
  };

  const handleAddHeadgate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newHGId) return alert("Please enter a Gate ID.");
      if (!newHGLat) return alert("Please select a Rider/Lateral for this headgate.");
      
      try {
          await createHeadgate({ 
              id: newHGId, 
              name: newHGId, 
              lateralId: newHGLat, 
              tapNumber: newHGId 
          });
          setNewHGId(''); setNewHGLat('');
          await fetchData();
          await refreshFields();
          alert("Headgate registered successfully.");
      } catch (err: any) { alert(err.message); }
  };

  const handleAddField = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newFieldId) return alert("Please enter a Field ID.");
      if (!newFieldName) return alert("Please enter a Field Name.");
      try {
          await createField({ 
              id: newFieldId, 
              name: newFieldName, 
              crop: newFieldCrop, 
              acres: parseFloat(newFieldAcresValue) || 0,
              location: newFieldLoc,
              totalWaterAllocation: parseFloat(newFieldAlloc) || 0,
              owner: newFieldOwner,
              headgateIds: newFieldHGs
          });
          setNewFieldId(''); setNewFieldName(''); setNewFieldCrop(''); setNewFieldAcresValue(''); setNewFieldOwner(''); setNewFieldLoc(''); setNewFieldAlloc(''); setNewFieldHGs([]);
          await fetchData();
          await refreshFields();
          alert("Field registered and linked successfully.");
      } catch (err: any) { alert(err.message); }
  };

  const handleDeleteSingleField = async (fieldId: string, fieldName: string) => {
    if (window.confirm(`Are you sure you want to delete the field registry for "${fieldName}"? This will also remove its water order history.`)) {
        try {
            await deleteField(fieldId);
            await fetchData();
            await refreshWaterOrders();
            await refreshFields();
            alert(`Field "${fieldName}" deleted.`);
        } catch (err: any) {
            alert("Delete failed: " + (err.message || "Unknown error"));
        }
    }
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard
              title="Current Water Ordered"
              value={`${lateralReportData.reduce((s, c) => s + c.inches, 0).toLocaleString()} In`}
              icon={<WaterDropIcon className="h-6 w-6 text-blue-600" />}
              color="bg-blue-100"
            />
            <div onClick={() => setActiveTab('riders')} className="cursor-pointer bg-white p-6 rounded-2xl shadow-md flex items-center hover:bg-gray-50 transition-all border border-transparent hover:border-indigo-100">
                <div className="p-3 rounded-full bg-indigo-100">
                    <UserGroupIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="ml-4 flex-1">
                    <p className="text-xs text-gray-500 font-black uppercase tracking-widest">Active Personnel</p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {featuredRiders.map(r => (
                            <span key={r.id} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">
                                {r.name.split(' ')[0]}
                            </span>
                        ))}
                    </div>
                </div>
                <ChevronDownIcon className="h-5 w-5 text-gray-400 -rotate-90" />
            </div>
            <DashboardCard
              title="Orders Pending Review"
              value={waterOrders.filter(o => o.status === WaterOrderStatus.Pending).length}
              icon={<ClockIcon className="h-6 w-6 text-yellow-600" />}
              color="bg-yellow-100"
            />
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Water Orders by Lateral</h3>
                    <p className="text-sm text-gray-500">Total requested Miner's Inches per distribution channel</p>
                </div>
            </div>
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lateralReportData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12, fontWeight: 700}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280', fontSize: 12}} />
                        <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="inches" fill="#2563eb" radius={[6, 6, 0, 0]} name="Total Inches" barSize={60} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-6 uppercase tracking-tight">Delivery Run Activity</h3>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lateralReportData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={4} dot={{r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} name="Task Count" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <WaterOrderList 
                orders={waterOrders.filter(o => o.status === WaterOrderStatus.Pending)} 
                title="Immediate Approval Queue"
                actions={(o) => (
                    <div className="flex space-x-2">
                        <button onClick={() => handleUpdateStatus(o.id, WaterOrderStatus.Approved)} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-black uppercase hover:bg-blue-700 transition-all">Approve</button>
                        <button onClick={() => handleUpdateStatus(o.id, WaterOrderStatus.Cancelled)} className="px-3 py-1 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-black uppercase hover:bg-red-50 transition-all">Deny</button>
                    </div>
                )}
            />
        </div>
    </div>
  );

  const renderRiders = () => {
    if (selectedRider) {
        const riderOrders = waterOrders.filter(o => o.status === WaterOrderStatus.Approved || o.status === WaterOrderStatus.InProgress);
        const groupedRun = laterals.map(lat => ({
            ...lat,
            orders: riderOrders.filter(o => o.lateralId === lat.id)
        })).filter(l => l.orders.length > 0);

        return (
            <div className="animate-in slide-in-from-right duration-300">
                <button onClick={() => setSelectedRider(null)} className="mb-6 flex items-center text-blue-600 hover:text-blue-800 font-black text-sm uppercase tracking-widest group">
                    <span className="mr-2 group-hover:-translate-x-1 transition-transform text-lg">←</span> Back to Personnel List
                </button>
                <div className="bg-white p-8 rounded-3xl shadow-xl border border-gray-100">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-10 pb-8 border-b border-gray-100 gap-6">
                        <div className="flex items-center space-x-6 text-center sm:text-left">
                            <div className="bg-blue-600 p-5 rounded-2xl shadow-xl shadow-blue-100 text-white">
                                <UserGroupIcon className="h-10 w-10"/>
                            </div>
                            <div>
                                <h2 className="text-4xl font-black text-gray-900 leading-none">{selectedRider.name}</h2>
                                <p className="text-gray-400 font-black uppercase text-xs tracking-[0.3em] mt-2">Ditch Rider #00{selectedRider.id}</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-10">
                        <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6 flex items-center">
                            <span className="w-2.5 h-8 bg-blue-600 rounded-full mr-4"></span>
                            Current Assigned Run (By Lateral)
                        </h3>
                        <div className="space-y-8">
                            {groupedRun.map(lat => (
                                <div key={lat.id} className="bg-gray-50 rounded-3xl overflow-hidden border border-gray-200">
                                    <div className="bg-gray-900 px-8 py-4 flex justify-between items-center text-white">
                                        <span className="font-black uppercase text-sm">{lat.name}</span>
                                        <span className="text-[10px] font-black uppercase">{lat.orders.length} Tasks</span>
                                    </div>
                                    <div className="divide-y divide-gray-200">
                                        {lat.orders.map(o => (
                                            <div key={o.id} className="p-6 hover:bg-white transition-colors">
                                                <h4 className="text-xl font-black text-gray-900">{o.fieldName}</h4>
                                                <p className="text-sm text-gray-500 font-bold uppercase">Tap: {o.tapNumber}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {ditchRiders.map(rider => (
                <div key={rider.id} onClick={() => setSelectedRider(rider)} className="bg-white p-8 rounded-3xl shadow-lg border-b-[12px] border-blue-600 cursor-pointer hover:-translate-y-2 transition-all">
                    <h3 className="text-3xl font-black text-gray-900">{rider.name}</h3>
                    <p className="text-xs text-gray-400 font-black uppercase tracking-[0.2em] mt-2">Ditch Rider</p>
                </div>
            ))}
        </div>
    );
  };

  const renderAdmin = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-300">
        <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-900 p-8 text-white">
                <h3 className="text-2xl font-black uppercase tracking-tight">Infrastructure Command Center</h3>
                <p className="text-gray-400 font-bold text-sm">Central registry for Riders, Gates, and Fields</p>
            </div>

            <div className="p-8 space-y-12">
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-blue-600">
                            <UserGroupIcon className="h-6 w-6" />
                            <h4 className="text-lg font-black uppercase tracking-widest">1. Lateral Registry</h4>
                        </div>
                        <form onSubmit={handleAddLateral} className="grid grid-cols-1 gap-4 bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                            <input value={newLatName} onChange={e => setNewLatName(e.target.value)} placeholder="Lateral Name (e.g. VanDoozer)" className="px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                            <button type="submit" className="bg-blue-600 text-white py-3 rounded-xl font-black uppercase text-xs hover:bg-blue-700">Add Lateral</button>
                        </form>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-green-600">
                            <RefreshIcon className="h-6 w-6" />
                            <h4 className="text-lg font-black uppercase tracking-widest">2. Headgate Registry</h4>
                        </div>
                        <form onSubmit={handleAddHeadgate} className="grid grid-cols-1 gap-4 bg-green-50/50 p-6 rounded-3xl border border-green-100">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input value={newHGId} onChange={e => setNewHGId(e.target.value)} placeholder="Gate ID (Auto-populates Name/Tap)" className="px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-green-500 w-full" />
                                <select value={newHGLat} onChange={e => setNewHGLat(e.target.value)} className="px-4 py-3 border border-gray-200 rounded-xl bg-white font-bold outline-none focus:ring-2 focus:ring-green-500 w-full">
                                    <option value="">Select Rider/Lateral...</option>
                                    {combinedLateralOptions.map(l => <option key={l.id} value={l.id}>{l.name} {l.id !== l.name ? `(${l.id})` : ''}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="bg-green-600 text-white py-3 rounded-xl font-black uppercase text-xs hover:bg-green-700">Add Headgate</button>
                        </form>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-12">
                    <div className="space-y-6">
                        <div className="flex items-center space-x-3 text-indigo-600">
                            <ViewGridIcon className="h-6 w-6" />
                            <h4 className="text-lg font-black uppercase tracking-widest">3. Field Registry & Asset Mapping</h4>
                        </div>
                        <form onSubmit={handleAddField} className="space-y-6 bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <input value={newFieldId} onChange={e => setNewFieldId(e.target.value)} placeholder="Field ID (F-001)" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                                <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="Field Name" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                                <input value={newFieldCrop} onChange={e => setNewFieldCrop(e.target.value)} placeholder="Primary Crop" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <input type="number" value={newFieldAcresValue} onChange={e => setNewFieldAcresValue(e.target.value)} placeholder="Acres" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                                <input value={newFieldOwner} onChange={e => setNewFieldOwner(e.target.value)} placeholder="Owner Name" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                                <input type="number" value={newFieldAlloc} onChange={e => setNewFieldAlloc(e.target.value)} placeholder="Season Allocation (AF)" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
                                <select multiple value={newFieldHGs} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewFieldHGs(Array.from(e.target.selectedOptions, (o: HTMLOptionElement) => o.value))} className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-white font-bold h-[48px] outline-none focus:ring-2 focus:ring-indigo-500">
                                    {headgates.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-sm hover:bg-indigo-700">Register Field Assets</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {fields.map(f => (
                <div key={f.id} className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 group relative">
                    <button 
                        onClick={() => handleDeleteSingleField(f.id, f.name)}
                        className="absolute top-4 right-4 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                        title="Delete Field Registry"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                    <p className="font-black text-gray-900 text-lg leading-tight pr-8">{f.name}</p>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase mt-1 tracking-widest">{f.owner || 'Registered Asset'}</p>
                    <div className="mt-4 flex gap-1 flex-wrap">
                        {(f.headgate_ids || []).map(hg => (
                            <span key={hg} className="text-[9px] bg-gray-50 border border-gray-100 px-2 py-0.5 rounded font-black text-gray-400 uppercase">{hg}</span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  return (
    <div className="space-y-12 pb-24 max-w-[1600px] mx-auto">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 border-b-2 border-gray-100 pb-10">
        <div>
            <div className="flex items-center gap-3 mb-3">
                <span className="w-12 h-1.5 bg-blue-600 rounded-full"></span>
                <p className="text-xs font-black text-blue-600 uppercase tracking-[0.4em]">Water Authority Dashboard</p>
            </div>
            <h1 className="text-5xl font-black text-gray-900 tracking-tighter flex items-center">
                Operations Center
                {isLoading && <RefreshIcon className="ml-6 h-8 w-8 text-blue-500 animate-spin" />}
            </h1>
            <p className="text-gray-400 font-bold mt-2 text-lg">Central Control for Infrastructure & Resource Distribution</p>
        </div>
        
        <div className="flex bg-gray-100 rounded-[2rem] p-2 border-2 border-white shadow-inner self-start xl:self-auto">
            <button 
                onClick={() => { setActiveTab('overview'); setSelectedRider(null); }} 
                className={`px-8 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'overview' ? 'bg-white text-blue-600 shadow-xl shadow-blue-100 scale-105' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Overview
            </button>
            <button 
                onClick={() => { setActiveTab('riders'); setSelectedRider(null); }} 
                className={`px-8 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'riders' ? 'bg-white text-blue-600 shadow-xl shadow-blue-100 scale-105' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Rider Fleet
            </button>
            <button 
                onClick={() => { setActiveTab('admin'); setSelectedRider(null); }} 
                className={`px-8 py-3.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'admin' ? 'bg-white text-blue-600 shadow-xl shadow-blue-100 scale-105' : 'text-gray-500 hover:text-gray-700'}`}
            >
                System Config
            </button>
        </div>
      </div>

      <div className="relative">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'riders' && renderRiders()}
        {activeTab === 'admin' && renderAdmin()}
      </div>
    </div>
  );
};

export default WaterOfficeDashboard;
