
import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { WaterOrder, WaterOrderStatus, User, Lateral, Headgate, UserRole, WaterOrderType } from '../types';
import WaterOrderList from '../components/WaterOrderList';
import DashboardCard from '../components/DashboardCard';
import { 
    ClockIcon, CheckCircleIcon, RefreshIcon, WaterDropIcon, 
    DocumentReportIcon, UserGroupIcon, ChevronDownIcon, 
    XCircleIcon, PlusIcon, TrashIcon 
} from '../components/icons';
import { 
    updateWaterOrder, getLaterals, getHeadgates, 
    createLateral, createHeadgate, resetDatabase 
} from '../services/api';
import { USERS } from '../constants';

interface WaterOfficeDashboardProps {
  waterOrders: WaterOrder[];
  refreshWaterOrders: () => Promise<void>;
}

type Tab = 'overview' | 'riders' | 'admin';

const WaterOfficeDashboard: React.FC<WaterOfficeDashboardProps> = ({ waterOrders, refreshWaterOrders }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedRider, setSelectedRider] = useState<User | null>(null);
  const [laterals, setLaterals] = useState<Lateral[]>([]);
  const [headgates, setHeadgates] = useState<Headgate[]>([]);
  const [reportDateRange, setReportDateRange] = useState<'day' | 'week' | 'month'>('week');
  const [isLoading, setIsLoading] = useState(true);
  
  // Admin form state
  const [newLatId, setNewLatId] = useState('');
  const [newLatName, setNewLatName] = useState('');
  const [newHGId, setNewHGId] = useState('');
  const [newHGName, setNewHGName] = useState('');
  const [newHGLat, setNewHGLat] = useState('');
  const [newHGTap, setNewHGTap] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
        const [l, h] = await Promise.all([getLaterals(), getHeadgates()]);
        setLaterals(l);
        setHeadgates(h);
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

  // REAL-TIME CALCULATIONS: Miner's Inches by Lateral
  // 1 AF = 25 Miner's Inches
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
  }, [waterOrders, laterals, reportDateRange]);

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
      if (!newLatId || !newLatName) return;
      try {
          await createLateral({ id: newLatId, name: newLatName });
          setLaterals(prev => [...prev, { id: newLatId, name: newLatName }]);
          setNewLatId(''); setNewLatName('');
      } catch (err: any) { alert(err.message); }
  };

  const handleAddHeadgate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newHGId || !newHGName || !newHGLat) {
          alert("Error: All headgates must be assigned to a lateral for reporting purposes.");
          return;
      }
      try {
          await createHeadgate({ id: newHGId, name: newHGName, lateralId: newHGLat, tapNumber: newHGTap });
          setHeadgates(prev => [...prev, { id: newHGId, name: newHGName, lateralId: newHGLat, tapNumber: newHGTap }]);
          setNewHGId(''); setNewHGName(''); setNewHGLat(''); setNewHGTap('');
      } catch (err: any) { alert(err.message); }
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

        {/* Real-time Order Reporting by Lateral */}
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Water Orders by Lateral</h3>
                    <p className="text-sm text-gray-500">Total requested Miner's Inches per distribution channel</p>
                </div>
                <div className="flex bg-gray-100 rounded-xl p-1 text-xs font-bold border border-gray-200">
                    <button onClick={() => setReportDateRange('day')} className={`px-4 py-2 rounded-lg transition-all ${reportDateRange === 'day' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Today</button>
                    <button onClick={() => setReportDateRange('week')} className={`px-4 py-2 rounded-lg transition-all ${reportDateRange === 'week' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>This Week</button>
                    <button onClick={() => setReportDateRange('month')} className={`px-4 py-2 rounded-lg transition-all ${reportDateRange === 'month' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>This Month</button>
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
                        <div className="bg-green-50 px-6 py-3 rounded-2xl border border-green-200">
                            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Shift Status</p>
                            <p className="text-sm font-black text-green-700">ACTIVE ON RUN</p>
                        </div>
                    </div>

                    <div className="space-y-10">
                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6 flex items-center">
                                <span className="w-2.5 h-8 bg-blue-600 rounded-full mr-4"></span>
                                Current Assigned Run (By Lateral)
                            </h3>
                            {groupedRun.length === 0 ? (
                                <div className="p-16 text-center bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                    <ClockIcon className="h-12 w-12 text-gray-300 mx-auto mb-4"/>
                                    <p className="text-gray-500 font-black text-lg uppercase tracking-tight">No Active Tasks</p>
                                    <p className="text-gray-400 text-sm mt-1">Assignments will appear here once orders are approved.</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {groupedRun.map(lat => (
                                        <div key={lat.id} className="bg-gray-50 rounded-3xl overflow-hidden border border-gray-200 shadow-sm transition-all hover:shadow-md">
                                            <div className="bg-gray-900 px-8 py-4 flex justify-between items-center">
                                                <span className="font-black text-white uppercase text-sm tracking-[0.2em]">{lat.name}</span>
                                                <span className="text-[10px] bg-white/10 text-white/70 px-3 py-1 rounded-full font-black uppercase">{lat.orders.length} Tasks</span>
                                            </div>
                                            <div className="divide-y divide-gray-200">
                                                {lat.orders.map(o => (
                                                    <div key={o.id} className="p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 hover:bg-white transition-colors">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-3">
                                                                <h4 className="text-2xl font-black text-gray-900">{o.fieldName}</h4>
                                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${o.orderType === WaterOrderType.TurnOn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {o.orderType}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 font-bold uppercase tracking-tight">
                                                                <p>Tap: <span className="font-mono text-gray-900">{o.tapNumber}</span></p>
                                                                <p>Status: <span className="text-blue-600 italic">{o.status}</span></p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-12 text-right">
                                                            <div>
                                                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Inches</p>
                                                                <p className="text-3xl font-black text-blue-700">{(o.requestedAmount * 25).toFixed(0)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Target Date</p>
                                                                <p className="text-base font-black text-gray-900">{o.deliveryStartDate}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
            {ditchRiders.map(rider => (
                <div key={rider.id} onClick={() => setSelectedRider(rider)} className="group bg-white p-8 rounded-3xl shadow-lg border-b-[12px] border-blue-600 cursor-pointer hover:shadow-2xl transition-all hover:-translate-y-2 relative overflow-hidden">
                    <div className="absolute -top-6 -right-6 opacity-5 group-hover:opacity-10 transition-opacity">
                        <UserGroupIcon className="h-32 w-32 text-blue-900" />
                    </div>
                    <div className="flex justify-between items-start mb-8">
                        <div className="bg-blue-50 p-4 rounded-2xl"><UserGroupIcon className="h-6 w-6 text-blue-600"/></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black px-3 py-1 bg-green-100 text-green-700 rounded-full uppercase tracking-widest">Active</span>
                            <span className="text-[9px] text-gray-400 font-black mt-1 uppercase tracking-tighter">On System</span>
                        </div>
                    </div>
                    <h3 className="text-3xl font-black text-gray-900 group-hover:text-blue-700 transition-colors">{rider.name}</h3>
                    <p className="text-xs text-gray-400 font-black uppercase tracking-[0.2em] mt-2">Personnel ID: 00{rider.id}</p>
                    <div className="mt-10 pt-8 border-t border-gray-50 flex justify-between items-center text-[10px] font-black text-gray-500 uppercase tracking-widest">
                        <span>Current Tasks: 4</span>
                        <span className="text-blue-600 group-hover:translate-x-2 transition-transform">Run Logs →</span>
                    </div>
                </div>
            ))}
        </div>
    );
  };

  const renderAdmin = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in slide-in-from-bottom-6 duration-300">
        {/* Lateral Manager */}
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
            <div className="flex items-center mb-10">
                <div className="bg-blue-600 p-4 rounded-2xl mr-5 text-white shadow-lg shadow-blue-100"><DocumentReportIcon className="h-8 w-8"/></div>
                <div>
                    <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Laterals</h3>
                    <p className="text-sm text-gray-500 font-medium">Define main distribution channels</p>
                </div>
            </div>
            
            <form onSubmit={handleAddLateral} className="space-y-6 mb-10 bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">System ID</label>
                        <input value={newLatId} onChange={e => setNewLatId(e.target.value)} placeholder="e.g. L-1" className="w-full px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Lateral Name</label>
                        <input value={newLatName} onChange={e => setNewLatName(e.target.value)} placeholder="e.g. North Lateral" className="w-full px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-blue-100 outline-none font-bold transition-all" />
                    </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all active:scale-95">Register Lateral</button>
            </form>

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {laterals.map(l => (
                    <div key={l.id} className="flex justify-between items-center p-6 bg-white rounded-2xl border border-gray-200 hover:border-blue-200 transition-all shadow-sm group">
                        <div className="flex items-center">
                            <span className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 rounded-xl font-black text-xs mr-5">{l.id.substr(0,2)}</span>
                            <span className="font-black text-gray-800 tracking-tight text-lg">{l.name}</span>
                        </div>
                        <button className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><TrashIcon className="h-6 w-6"/></button>
                    </div>
                ))}
            </div>
        </div>

        {/* Headgate Manager */}
        <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
            <div className="flex items-center mb-10">
                <div className="bg-green-600 p-4 rounded-2xl mr-5 text-white shadow-lg shadow-green-100"><RefreshIcon className="h-8 w-8"/></div>
                <div>
                    <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Headgates</h3>
                    <p className="text-sm text-gray-500 font-medium">Link endpoints to lateral channels</p>
                </div>
            </div>

            <form onSubmit={handleAddHeadgate} className="space-y-6 mb-10 bg-gray-50 p-6 rounded-2xl border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Gate ID</label>
                        <input value={newHGId} onChange={e => setNewHGId(e.target.value)} placeholder="HG-101" className="w-full px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-green-100 outline-none font-bold" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Gate Name</label>
                        <input value={newHGName} onChange={e => setNewHGName(e.target.value)} placeholder="East Main" className="w-full px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-green-100 outline-none font-bold" />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Parent Lateral</label>
                        <select value={newHGLat} onChange={e => setNewHGLat(e.target.value)} className="w-full px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-green-100 outline-none bg-white font-bold">
                            <option value="">Choose Lateral...</option>
                            {laterals.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tap Ref #</label>
                        <input value={newHGTap} onChange={e => setNewHGTap(e.target.value)} placeholder="T-1234" className="w-full px-5 py-3 border border-gray-300 rounded-xl focus:ring-4 focus:ring-green-100 outline-none font-bold" />
                    </div>
                </div>
                <button type="submit" className="w-full bg-green-600 text-white py-4 rounded-xl font-black uppercase tracking-[0.2em] text-xs hover:bg-green-700 shadow-xl shadow-green-100 transition-all active:scale-95">Register Headgate</button>
            </form>

            <div className="space-y-4 max-h-[310px] overflow-y-auto pr-2 custom-scrollbar">
                {headgates.map(h => (
                    <div key={h.id} className="p-6 bg-white rounded-2xl border border-gray-200 hover:border-green-200 transition-all shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                            <span className="font-black text-gray-900 text-lg tracking-tight">{h.name}</span>
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-black uppercase tracking-widest">
                                {laterals.find(l => l.id === h.lateralId)?.name || 'UNKNOWN'}
                            </span>
                        </div>
                        <div className="flex items-center text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
                            <span className="mr-5">Gate ID: {h.id}</span>
                            <span>Tap: {h.tapNumber}</span>
                        </div>
                    </div>
                ))}
            </div>
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
