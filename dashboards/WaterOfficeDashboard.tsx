
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
  
  // Admin form state
  const [newLatId, setNewLatId] = useState('');
  const [newLatName, setNewLatName] = useState('');
  const [newHGId, setNewHGId] = useState('');
  const [newHGName, setNewHGName] = useState('');
  const [newHGLat, setNewHGLat] = useState('');
  const [newHGTap, setNewHGTap] = useState('');

  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const [l, h] = await Promise.all([getLaterals(), getHeadgates()]);
            setLaterals(l);
            setHeadgates(h);
        } catch (e) {
            console.error("Failed to load admin data", e);
        } finally {
            setIsLoadingData(false);
        }
    };
    fetchData();
  }, []);

  const ditchRiders = useMemo(() => USERS.filter(u => u.role === UserRole.DitchRider), []);
  const featuredRiders = ditchRiders.slice(0, 3);

  // REAL-TIME CALCULATIONS: Miner's Inches by Lateral
  // Rule: 1 AF = 25 Miner's Inches
  const lateralReportData = useMemo(() => {
    const data: Record<string, { name: string, inches: number, count: number }> = {};
    
    laterals.forEach(l => {
        data[l.id] = { name: l.name, inches: 0, count: 0 };
    });

    waterOrders.forEach(o => {
        if (data[o.lateralId]) {
            // In a real scenario, we'd filter these based on the `reportDateRange` selected
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
      } catch (err: any) {
          alert(err.message);
      }
  };

  const handleAddHeadgate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newHGId || !newHGName || !newHGLat) {
          alert("All headgates MUST be assigned to a lateral for reporting purposes.");
          return;
      }
      try {
          await createHeadgate({ id: newHGId, name: newHGName, lateralId: newHGLat, tapNumber: newHGTap });
          const newHG = { id: newHGId, name: newHGName, lateralId: newHGLat, tapNumber: newHGTap };
          setHeadgates(prev => [...prev, newHG]);
          setNewHGId(''); setNewHGName(''); setNewHGLat(''); setNewHGTap('');
      } catch (err: any) {
          alert(err.message);
      }
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard
              title="Total Inches Ordered"
              value={`${lateralReportData.reduce((s, c) => s + c.inches, 0).toLocaleString()} In`}
              icon={<WaterDropIcon className="h-6 w-6 text-blue-600" />}
              color="bg-blue-100"
            />
            <div onClick={() => setActiveTab('riders')} className="cursor-pointer bg-white p-6 rounded-lg shadow-md flex items-center hover:bg-gray-50 transition-colors border border-transparent hover:border-indigo-200">
                <div className="p-3 rounded-full bg-indigo-100">
                    <UserGroupIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="ml-4 flex-1">
                    <p className="text-sm text-gray-500 font-medium">Active Ditch Riders</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                        {featuredRiders.map(r => (
                            <span key={r.id} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-black uppercase tracking-tight">
                                {r.name.split(' ')[0]}
                            </span>
                        ))}
                    </div>
                </div>
                <ChevronDownIcon className="h-5 w-5 text-gray-400 -rotate-90" />
            </div>
            <DashboardCard
              title="Awaiting Approval"
              value={waterOrders.filter(o => o.status === WaterOrderStatus.Pending).length}
              icon={<ClockIcon className="h-6 w-6 text-yellow-600" />}
              color="bg-yellow-100"
            />
        </div>

        {/* Real-time Order Reporting by Lateral */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Water Orders by Lateral</h3>
                    <p className="text-sm text-gray-500">Aggregated Miner's Inches for all active orders</p>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-1 text-xs font-bold border border-gray-200">
                    <button onClick={() => setReportDateRange('day')} className={`px-3 py-1.5 rounded-md transition-all ${reportDateRange === 'day' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Current Day</button>
                    <button onClick={() => setReportDateRange('week')} className={`px-3 py-1.5 rounded-md transition-all ${reportDateRange === 'week' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Current Week</button>
                    <button onClick={() => setReportDateRange('month')} className={`px-3 py-1.5 rounded-md transition-all ${reportDateRange === 'month' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Current Month</button>
                </div>
            </div>
            
            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lateralReportData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#6b7280', fontSize: 12, fontWeight: 700}}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#6b7280', fontSize: 12}}
                            label={{ value: "Miner's Inches", angle: -90, position: 'insideLeft', style: {fontSize: 12, fill: '#9ca3af', fontWeight: 600} }}
                        />
                        <Tooltip 
                            cursor={{fill: '#f9fafb'}} 
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Bar 
                            dataKey="inches" 
                            fill="#2563eb" 
                            radius={[6, 6, 0, 0]} 
                            name="Total Inches"
                            barSize={60}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Request Volume Trends</h3>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={lateralReportData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Tooltip />
                            <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff'}} name="Order Count" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <WaterOrderList 
                orders={waterOrders.filter(o => o.status === WaterOrderStatus.Pending)} 
                title="Office Review Queue"
                actions={(o) => (
                    <div className="flex space-x-2">
                        <button onClick={() => handleUpdateStatus(o.id, WaterOrderStatus.Approved)} className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700">Approve</button>
                        <button onClick={() => handleUpdateStatus(o.id, WaterOrderStatus.Cancelled)} className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-bold hover:bg-red-100">Reject</button>
                    </div>
                )}
            />
        </div>
    </div>
  );

  const renderRiders = () => {
    if (selectedRider) {
        // Find all orders that this rider would see on their run
        const riderOrders = waterOrders.filter(o => 
            o.status === WaterOrderStatus.Approved || 
            o.status === WaterOrderStatus.InProgress
        );

        // Group these orders by Lateral
        const groupedRun = laterals.map(lat => ({
            ...lat,
            orders: riderOrders.filter(o => o.lateralId === lat.id)
        })).filter(l => l.orders.length > 0);

        return (
            <div className="animate-in slide-in-from-right duration-300">
                <button onClick={() => setSelectedRider(null)} className="mb-6 flex items-center text-blue-600 hover:text-blue-800 font-bold text-sm uppercase tracking-wide group">
                    <span className="mr-2 group-hover:-translate-x-1 transition-transform">←</span> Back to Rider Directory
                </button>
                
                <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-gray-100 gap-4">
                        <div className="flex items-center space-x-5">
                            <div className="bg-blue-600 p-4 rounded-2xl shadow-blue-200 shadow-lg">
                                <UserGroupIcon className="h-8 w-8 text-white"/>
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-gray-900">{selectedRider.name}</h2>
                                <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">Ditch Rider #00{selectedRider.id}</p>
                            </div>
                        </div>
                        <div className="bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                            <p className="text-[10px] font-black text-green-600 uppercase">Status</p>
                            <p className="text-sm font-bold text-green-700">ON SHIFT</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center">
                                <span className="bg-blue-600 w-2 h-6 mr-3 rounded-full"></span>
                                Current Run Configuration
                            </h3>
                            {groupedRun.length === 0 ? (
                                <div className="p-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                                    <ClockIcon className="h-10 w-10 text-gray-300 mx-auto mb-3"/>
                                    <p className="text-gray-500 font-medium">No active or approved orders on this rider's laterals.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {groupedRun.map(lat => (
                                        <div key={lat.id} className="bg-gray-50 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                            <div className="bg-gray-800 px-6 py-3 flex justify-between items-center">
                                                <span className="font-black text-white uppercase text-sm tracking-widest">{lat.name}</span>
                                                <span className="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded font-bold uppercase">{lat.orders.length} Tasks</span>
                                            </div>
                                            <div className="divide-y divide-gray-200">
                                                {lat.orders.map(o => (
                                                    <div key={o.id} className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 hover:bg-white transition-colors">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="text-lg font-black text-gray-900">{o.fieldName}</h4>
                                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${o.orderType === WaterOrderType.TurnOn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {o.orderType}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 font-medium">
                                                                <p>Tap: <span className="font-mono text-gray-900">{o.tapNumber}</span></p>
                                                                <p>Status: <span className="text-blue-600 font-bold italic">{o.status}</span></p>
                                                            </div>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-8 text-right">
                                                            <div>
                                                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Inches</p>
                                                                <p className="text-2xl font-black text-blue-700">{(o.requestedAmount * 25).toFixed(0)}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Target Date</p>
                                                                <p className="text-sm font-black text-gray-900">{o.deliveryStartDate}</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {ditchRiders.map(rider => (
                <div key={rider.id} onClick={() => setSelectedRider(rider)} className="group bg-white p-6 rounded-2xl shadow-md border-b-8 border-blue-600 cursor-pointer hover:shadow-2xl transition-all hover:-translate-y-1 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <UserGroupIcon className="h-16 w-16 text-blue-900" />
                    </div>
                    <div className="flex justify-between items-start mb-6">
                        <div className="bg-blue-50 p-3 rounded-xl"><UserGroupIcon className="h-6 w-6 text-blue-600"/></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black px-2 py-0.5 bg-green-100 text-green-700 rounded-full uppercase tracking-widest">Available</span>
                            <span className="text-[9px] text-gray-400 font-bold mt-1">On Shift</span>
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-gray-900 group-hover:text-blue-700 transition-colors">{rider.name}</h3>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">District Rider ID: 00{rider.id}</p>
                    <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-center text-xs font-black text-gray-500 uppercase tracking-widest">
                        <span>4 Active Orders</span>
                        <span className="text-blue-600 group-hover:translate-x-1 transition-transform">Run Details →</span>
                    </div>
                </div>
            ))}
        </div>
    );
  };

  const renderAdmin = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-300">
        {/* Lateral Manager */}
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col h-full">
            <div className="flex items-center mb-8">
                <div className="bg-blue-100 p-3 rounded-xl mr-4"><DocumentReportIcon className="h-6 w-6 text-blue-600"/></div>
                <div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Lateral Directory</h3>
                    <p className="text-xs text-gray-500">Define the main distribution channels</p>
                </div>
            </div>
            
            <form onSubmit={handleAddLateral} className="space-y-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Lateral ID</label>
                        <input value={newLatId} onChange={e => setNewLatId(e.target.value)} placeholder="e.g. L-100" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Display Name</label>
                        <input value={newLatName} onChange={e => setNewLatName(e.target.value)} placeholder="e.g. South Lateral" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
                    </div>
                </div>
                <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded-lg font-black uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-95">Add New Lateral</button>
            </form>

            <div className="flex-1 space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {laterals.length === 0 ? (
                    <p className="text-center py-8 text-gray-400 italic">No laterals defined yet.</p>
                ) : (
                    laterals.map(l => (
                        <div key={l.id} className="flex justify-between items-center p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-200 transition-colors shadow-sm">
                            <div className="flex items-center">
                                <span className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 rounded-lg font-black text-xs mr-4">{l.id.substr(0,2)}</span>
                                <span className="font-bold text-gray-800 tracking-tight">{l.name}</span>
                            </div>
                            <button className="p-2 text-gray-300 hover:text-red-500 transition-colors"><TrashIcon className="h-5 w-5"/></button>
                        </div>
                    ))
                )}
            </div>
        </div>

        {/* Headgate Manager */}
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col h-full">
            <div className="flex items-center mb-8">
                <div className="bg-green-100 p-3 rounded-xl mr-4"><RefreshIcon className="h-6 w-6 text-green-600"/></div>
                <div>
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Headgate Registry</h3>
                    <p className="text-xs text-gray-500">Must be assigned to a lateral channel</p>
                </div>
            </div>

            <form onSubmit={handleAddHeadgate} className="space-y-4 mb-8 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Gate ID</label>
                        <input value={newHGId} onChange={e => setNewHGId(e.target.value)} placeholder="HG-001" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Gate Name</label>
                        <input value={newHGName} onChange={e => setNewHGName(e.target.value)} placeholder="Main Spillway" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Assign Lateral</label>
                        <select value={newHGLat} onChange={e => setNewHGLat(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white">
                            <option value="">Select Lateral...</option>
                            {laterals.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-500 uppercase ml-1">Tap Reference</label>
                        <input value={newHGTap} onChange={e => setNewHGTap(e.target.value)} placeholder="A-1234" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                    </div>
                </div>
                <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-lg font-black uppercase tracking-widest text-xs hover:bg-green-700 shadow-lg shadow-green-100 transition-all active:scale-95">Register Headgate</button>
            </form>

            <div className="flex-1 space-y-3 max-h-[310px] overflow-y-auto pr-2 custom-scrollbar">
                {headgates.length === 0 ? (
                    <p className="text-center py-8 text-gray-400 italic">No headgates registered.</p>
                ) : (
                    headgates.map(h => (
                        <div key={h.id} className="p-4 bg-white rounded-xl border border-gray-200 hover:border-green-200 transition-all shadow-sm">
                            <div className="flex justify-between items-start mb-2">
                                <span className="font-black text-gray-900 tracking-tight">{h.name}</span>
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">
                                    {laterals.find(l => l.id === h.lateralId)?.name || 'UNKNOWN LATERAL'}
                                </span>
                            </div>
                            <div className="flex items-center text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                <span className="mr-3">ID: {h.id}</span>
                                <span>Tap: {h.tapNumber}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );

  return (
    <div className="space-y-10 pb-20">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div>
            <div className="flex items-center gap-2 mb-1">
                <span className="w-10 h-1 bg-blue-600 rounded-full"></span>
                <p className="text-xs font-black text-blue-600 uppercase tracking-[0.2em]">Operations Command</p>
            </div>
            <h1 className="text-4xl font-black text-gray-900 tracking-tight flex items-center">
                Water Office Dashboard
                {isLoadingData && <RefreshIcon className="ml-4 h-6 w-6 text-blue-500 animate-spin" />}
            </h1>
            <p className="text-gray-500 font-medium mt-1">Network Capacity Planning & Personnel Management</p>
        </div>
        
        <div className="flex bg-white rounded-2xl shadow-lg p-1.5 border border-gray-100 self-start xl:self-auto">
            <button 
                onClick={() => { setActiveTab('overview'); setSelectedRider(null); }} 
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                Capacity Overview
            </button>
            <button 
                onClick={() => { setActiveTab('riders'); setSelectedRider(null); }} 
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'riders' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                Rider Directory
            </button>
            <button 
                onClick={() => { setActiveTab('admin'); setSelectedRider(null); }} 
                className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'admin' ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                System Registry
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
