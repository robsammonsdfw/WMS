import React, { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { WaterOrder, WaterOrderStatus, User, Lateral, Headgate, UserRole, Field } from '../types';
import WaterOrderList from '../components/WaterOrderList';
import DashboardCard from '../components/DashboardCard';
import { 
    ClockIcon, WaterDropIcon, UserGroupIcon, ChevronDownIcon, 
    RefreshIcon, ChartBarIcon as ViewGridIcon, TrashIcon
} from '../components/icons';
import { 
    updateWaterOrder, getLaterals, getHeadgates, getFields,
    createLateral, createHeadgate, createField, deleteField 
} from '../services/api';
import { USERS } from '../constants';

interface WaterOfficeDashboardProps {
  waterOrders: WaterOrder[];
  refreshWaterOrders: () => Promise<void>;
  refreshFields: () => Promise<void>;
}

type Tab = 'overview' | 'riders' | 'admin';
type AnalyticsGrouping = 'lateral' | 'rider';
type AnalyticsTimeframe = 'today' | 'week' | 'month';

const WaterOfficeDashboard: React.FC<WaterOfficeDashboardProps> = ({ waterOrders, refreshWaterOrders, refreshFields }) => {
  // DEFENSIVE CHECK: Ensure waterOrders is always an array
  const safeOrders = Array.isArray(waterOrders) ? waterOrders : [];

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedRider, setSelectedRider] = useState<User | null>(null);
  const [laterals, setLaterals] = useState<Lateral[]>([]);
  const [headgates, setHeadgates] = useState<Headgate[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Analytics State
  const [grouping, setGrouping] = useState<AnalyticsGrouping>('lateral');
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('today');
  
  // Admin form states
  const [newLatName, setNewLatName] = useState('');
  const [newHGId, setNewHGId] = useState('');
  const [newHGLat, setNewHGLat] = useState('');
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
        // DEFENSIVE CHECKS: Protect against backend returning objects instead of arrays
        setLaterals(Array.isArray(l) ? l : []);
        setHeadgates(Array.isArray(h) ? h : []);
        setFields(Array.isArray(f) ? f : []);
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

  // --- ANALYTICS LOGIC ---
  const analyticsData = useMemo(() => {
    const dataMap: Record<string, { name: string; runningAF: number; newOrdersAF: number; totalVolume: number }> = {};

    // Helper to check date range
    const isInTimeframe = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        if (timeframe === 'today') {
            return date >= startOfDay;
        } else if (timeframe === 'week') {
            const startOfWeek = new Date(startOfDay);
            startOfWeek.setDate(startOfDay.getDate() - 7);
            return date >= startOfWeek;
        } else { // month
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return date >= startOfMonth;
        }
    };

    safeOrders.forEach(order => {
        let key = 'Unassigned';
        let name = 'Unassigned';

        if (grouping === 'lateral') {
            // Dynamic Key Generation: Use whatever is in the order data
            const rawLat = order.lateral || order.lateralId || 'Unassigned';
            key = rawLat.toUpperCase().trim(); 
            name = rawLat;
        } else {
            // Group by Rider
            // 1. Check if order has explicit rider ID
            if (order.ditchRiderId) {
                const rider = ditchRiders.find(u => u.id === order.ditchRiderId);
                if (rider) {
                    key = rider.id.toString();
                    name = rider.name.split(' ')[0];
                }
            } 
            
            // 2. If no ID match, fallback to Lateral String Matching against Rider Assignments
            if (key === 'Unassigned') {
                const latName = (order.lateral || order.lateralId || '').toLowerCase();
                const rider = ditchRiders.find(u => 
                    u.assignedLaterals?.some(al => al.toLowerCase() === latName || latName.includes(al.toLowerCase()))
                );
                if (rider) {
                    key = rider.id.toString();
                    name = rider.name.split(' ')[0];
                }
            }

            // 3. Fallback: If there is ONLY ONE ditch rider in the system, assign everything to them.
            // This covers demo scenarios where assignments might be loose but ownership is implied.
            if (key === 'Unassigned' && ditchRiders.length === 1) {
                const singleRider = ditchRiders[0];
                key = singleRider.id.toString();
                name = singleRider.name.split(' ')[0];
            }
        }

        // Initialize bucket if missing
        if (!dataMap[key]) {
            dataMap[key] = { name: name, runningAF: 0, newOrdersAF: 0, totalVolume: 0 };
        }

        const amount = Number(order.requestedAmount) || 0;

        // 1. Calculate Running Water (Currently In Progress)
        if (order.status === WaterOrderStatus.InProgress) {
            dataMap[key].runningAF += amount;
            dataMap[key].totalVolume += amount;
        }

        // 2. Calculate New Orders (Pending/Approved) WITHIN Timeframe
        if ((order.status === WaterOrderStatus.Pending || order.status === WaterOrderStatus.Approved) && order.deliveryStartDate) {
            if (isInTimeframe(order.deliveryStartDate)) {
                dataMap[key].newOrdersAF += amount;
                dataMap[key].totalVolume += amount;
            }
        }
    });

    // Post-Processing: Convert to Array and Sort
    let finalArray = Object.values(dataMap);

    // Remove empty Unassigned if it has no data
    finalArray = finalArray.filter(item => item.totalVolume > 0 || item.name !== 'Unassigned');

    // Sort by Total Volume Descending
    finalArray.sort((a, b) => b.totalVolume - a.totalVolume);

    // Limit to Top 15 to prevent overcrowding, group rest into "Others"
    if (finalArray.length > 15) {
        const top15 = finalArray.slice(0, 15);
        const others = finalArray.slice(15);
        
        const othersAgg = others.reduce((acc, curr) => ({
            name: 'Others',
            runningAF: acc.runningAF + curr.runningAF,
            newOrdersAF: acc.newOrdersAF + curr.newOrdersAF,
            totalVolume: acc.totalVolume + curr.totalVolume
        }), { name: 'Others', runningAF: 0, newOrdersAF: 0, totalVolume: 0 });

        return [...top15, othersAgg];
    }

    return finalArray;
  }, [safeOrders, ditchRiders, grouping, timeframe]);

  const totalRunningAF = safeOrders
    .filter(o => o.status === WaterOrderStatus.InProgress)
    .reduce((sum, o) => sum + (Number(o.requestedAmount) || 0), 0);
  
  const pendingCount = safeOrders.filter(o => o.status === WaterOrderStatus.Pending).length;

  const combinedLateralOptions = useMemo(() => {
    const options = [...laterals];
    const existingIds = new Set(laterals.map(l => l.id.toLowerCase()));
    const existingNames = new Set(laterals.map(l => l.name.toLowerCase()));

    fields.forEach(f => {
        if (f.lateral) {
            const latStr = f.lateral.trim();
            const latLower = latStr.toLowerCase();
            if (!existingIds.has(latLower) && !existingNames.has(latLower)) {
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
          await createHeadgate({ id: newHGId, name: newHGId, lateralId: newHGLat, tapNumber: newHGId });
          setNewHGId(''); setNewHGLat('');
          await fetchData();
          await refreshFields();
          alert("Headgate registered successfully.");
      } catch (err: any) { alert(err.message); }
  };

  const handleAddField = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newFieldId || !newFieldName) return alert("Please fill required fields.");
      try {
          await createField({ 
              id: newFieldId, name: newFieldName, crop: newFieldCrop, 
              acres: parseFloat(newFieldAcresValue) || 0, location: newFieldLoc,
              totalWaterAllocation: parseFloat(newFieldAlloc) || 0, owner: newFieldOwner,
              headgateIds: newFieldHGs
          });
          setNewFieldId(''); setNewFieldName(''); setNewFieldCrop(''); setNewFieldAcresValue(''); 
          setNewFieldOwner(''); setNewFieldLoc(''); setNewFieldAlloc(''); setNewFieldHGs([]);
          await fetchData();
          await refreshFields();
          alert("Field registered successfully.");
      } catch (err: any) { alert(err.message); }
  };

  const handleDeleteSingleField = async (fieldId: string, fieldName: string) => {
    if (window.confirm(`Delete field "${fieldName}"?`)) {
        try {
            await deleteField(fieldId);
            await fetchData();
            await refreshWaterOrders();
            await refreshFields();
        } catch (err: any) { alert("Delete failed: " + err.message); }
    }
  };

  const renderOverview = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard
              title="Total Active Water (Running)"
              value={`${totalRunningAF.toFixed(1)} AF`}
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
              value={pendingCount}
              icon={<ClockIcon className="h-6 w-6 text-yellow-600" />}
              color="bg-yellow-100"
            />
        </div>

        {/* Main Analytics Graph */}
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
            <div className="flex flex-col xl:flex-row justify-between items-center mb-8 gap-6">
                <div>
                    <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Resource Distribution Analytics</h3>
                    <p className="text-sm text-gray-500 mt-1">Real-time breakdown of active usage vs. upcoming demand.</p>
                </div>
                
                {/* Analytics Controls */}
                <div className="flex flex-wrap gap-3 items-center justify-center bg-gray-50 p-2 rounded-2xl">
                    <div className="flex items-center bg-white rounded-xl shadow-sm border border-gray-200 px-1">
                        <button 
                            onClick={() => setGrouping('lateral')} 
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${grouping === 'lateral' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            By Lateral
                        </button>
                        <button 
                            onClick={() => setGrouping('rider')} 
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${grouping === 'rider' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            By Ditch Rider
                        </button>
                    </div>

                    <div className="h-8 w-px bg-gray-300 mx-2 hidden sm:block"></div>

                    <div className="flex items-center bg-white rounded-xl shadow-sm border border-gray-200 px-1">
                        <button 
                            onClick={() => setTimeframe('today')} 
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${timeframe === 'today' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Today
                        </button>
                        <button 
                            onClick={() => setTimeframe('week')} 
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${timeframe === 'week' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            This Week
                        </button>
                        <button 
                            onClick={() => setTimeframe('month')} 
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-colors ${timeframe === 'month' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            This Month
                        </button>
                    </div>
                </div>
            </div>

            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData} barGap={0}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#6b7280', fontSize: 11, fontWeight: 700}} 
                            tickFormatter={(value) => value.toUpperCase()}
                            dy={10}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fill: '#6b7280', fontSize: 12}} 
                            label={{ value: 'Acre-Feet (AF)', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 10, fontWeight: 700 } }} 
                        />
                        <Tooltip 
                            cursor={{fill: '#f9fafb'}} 
                            contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px'}}
                            labelStyle={{fontSize: '14px', fontWeight: 900, color: '#111827', textTransform: 'uppercase', marginBottom: '8px'}}
                        />
                        <Legend 
                            verticalAlign="top" 
                            height={36} 
                            iconType="circle"
                            formatter={(value) => <span className="text-xs font-bold text-gray-500 uppercase ml-1 mr-4">{value}</span>}
                        />
                        <Bar dataKey="runningAF" name="Currently Running" fill="#2563eb" radius={[0, 0, 4, 4]} maxBarSize={60}>
                             {analyticsData.map((entry, index) => (
                                <Cell key={`cell-running-${index}`} fill="#3b82f6" />
                            ))}
                        </Bar>
                        <Bar dataKey="newOrdersAF" name="New Orders (Scheduled)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={60} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    Showing {timeframe} data grouped by {grouping === 'lateral' ? 'Lateral Channel' : 'Assigned Ditch Rider'} (Top 15 by Volume)
                </p>
            </div>
        </div>

        {/* Action Queue */}
        <div className="w-full">
            <WaterOrderList 
                orders={safeOrders.filter(o => o.status === WaterOrderStatus.Pending)} 
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
        const riderOrders = safeOrders.filter(o => o.status === WaterOrderStatus.Approved || o.status === WaterOrderStatus.InProgress);
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
                            <input value={newLatName} onChange={e => setNewLatName(e.target.value)} placeholder="Lateral Name (e.g. West Main)" className="px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
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
                                <input value={newHGId} onChange={e => setNewHGId(e.target.value)} placeholder="Gate ID" className="px-4 py-3 border border-gray-200 rounded-xl font-bold outline-none focus:ring-2 focus:ring-green-500 w-full" />
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