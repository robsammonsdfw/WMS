
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

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [l, h] = await Promise.all([getLaterals(), getHeadgates()]);
            setLaterals(l);
            setHeadgates(h);
        } catch (e) {
            console.error("Failed to load admin data", e);
        }
    };
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
            // Filter by date range if needed, for now all
            data[o.lateralId].inches += (o.requestedAmount || 0) * 25;
            data[o.lateralId].count += 1;
        }
    });

    return Object.values(data);
  }, [waterOrders, laterals]);

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
      await createLateral({ id: newLatId, name: newLatName });
      setLaterals(prev => [...prev, { id: newLatId, name: newLatName }]);
      setNewLatId(''); setNewLatName('');
  };

  const handleAddHeadgate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newHGId || !newHGName || !newHGLat) {
          alert("Headgates must be assigned to a lateral!");
          return;
      }
      await createHeadgate({ id: newHGId, name: newHGName, lateralId: newHGLat, tapNumber: newHGTap });
      setHeadgates(prev => [...prev, { id: newHGId, name: newHGName, lateralId: newHGLat, tapNumber: newHGTap }]);
      setNewHGId(''); setNewHGName(''); setNewHGLat(''); setNewHGTap('');
  };

  const renderOverview = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <DashboardCard
              title="Total Inches Requested"
              value={lateralReportData.reduce((s, c) => s + c.inches, 0).toLocaleString()}
              icon={<WaterDropIcon className="h-6 w-6 text-blue-600" />}
              color="bg-blue-100"
            />
            <div onClick={() => setActiveTab('riders')} className="cursor-pointer bg-white p-6 rounded-lg shadow-md flex items-center hover:bg-gray-50 transition-colors">
                <div className="p-3 rounded-full bg-indigo-100">
                    <UserGroupIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <div className="ml-4">
                    <p className="text-sm text-gray-500 font-medium">Active Ditch Riders</p>
                    <div className="flex space-x-2 mt-1">
                        {featuredRiders.map(r => (
                            <span key={r.id} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">
                                {r.name.split(' ')[0]}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
            <DashboardCard
              title="Pending Orders"
              value={waterOrders.filter(o => o.status === WaterOrderStatus.Pending).length}
              icon={<ClockIcon className="h-6 w-6 text-yellow-600" />}
              color="bg-yellow-100"
            />
        </div>

        {/* Dynamic Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Water Orders by Lateral (Inches)</h3>
                    <div className="flex bg-gray-100 rounded-md p-1 text-xs font-bold">
                        <button onClick={() => setReportDateRange('day')} className={`px-2 py-1 rounded ${reportDateRange === 'day' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Day</button>
                        <button onClick={() => setReportDateRange('week')} className={`px-2 py-1 rounded ${reportDateRange === 'week' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Week</button>
                        <button onClick={() => setReportDateRange('month')} className={`px-2 py-1 rounded ${reportDateRange === 'month' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Month</button>
                    </div>
                </div>
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <BarChart data={lateralReportData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis label={{ value: 'Inches', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Bar dataKey="inches" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total Inches" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Delivery Activity Trends</h3>
                <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                        <LineChart data={lateralReportData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} name="Orders" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        <WaterOrderList 
            orders={waterOrders.filter(o => o.status === WaterOrderStatus.Pending)} 
            title="Orders Awaiting Office Approval"
            actions={(o) => (
                <div className="flex space-x-2">
                    <button onClick={() => handleUpdateStatus(o.id, WaterOrderStatus.Approved)} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700">Approve</button>
                    <button onClick={() => handleUpdateStatus(o.id, WaterOrderStatus.Cancelled)} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700">Reject</button>
                </div>
            )}
        />
    </div>
  );

  const renderRiders = () => {
    if (selectedRider) {
        const riderOrders = waterOrders.filter(o => o.status === WaterOrderStatus.Approved || o.status === WaterOrderStatus.InProgress);
        // In a real app we'd filter by rider's assignments. Here we'll show grouped by Lateral.
        const groupedByLat = laterals.map(lat => ({
            ...lat,
            orders: riderOrders.filter(o => o.lateralId === lat.id)
        })).filter(l => l.orders.length > 0);

        return (
            <div className="animate-in slide-in-from-right duration-300">
                <button onClick={() => setSelectedRider(null)} className="mb-4 flex items-center text-blue-600 hover:text-blue-800 font-bold">
                    ← Back to Rider List
                </button>
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="bg-blue-100 p-4 rounded-full"><UserGroupIcon className="h-8 w-8 text-blue-600"/></div>
                        <div>
                            <h2 className="text-2xl font-bold">{selectedRider.name}</h2>
                            <p className="text-gray-500">Rider ID: R-{selectedRider.id}</p>
                        </div>
                    </div>

                    <h3 className="text-lg font-bold text-gray-800 mb-4">Assigned Run (Grouped by Lateral)</h3>
                    {groupedByLat.length === 0 ? (
                        <p className="text-gray-500 italic">No active orders on this rider's laterals.</p>
                    ) : (
                        <div className="space-y-6">
                            {groupedByLat.map(lat => (
                                <div key={lat.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-2 font-bold text-gray-700 border-b border-gray-200">
                                        {lat.name}
                                    </div>
                                    <div className="divide-y divide-gray-200">
                                        {lat.orders.map(o => (
                                            <div key={o.id} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <p className="font-bold text-gray-900">{o.fieldName}</p>
                                                    <p className="text-sm text-gray-500">
                                                        Tap: <span className="font-mono">{o.tapNumber}</span> • 
                                                        Type: <span className={`font-bold ${o.orderType === WaterOrderType.TurnOn ? 'text-green-600' : 'text-red-600'}`}>{o.orderType}</span>
                                                    </p>
                                                </div>
                                                <div className="text-right flex items-center space-x-6">
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase font-bold">Inches</p>
                                                        <p className="text-lg font-black text-blue-700">{o.requestedAmount * 25}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase font-bold">Start Date</p>
                                                        <p className="text-sm font-medium">{o.deliveryStartDate}</p>
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
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {ditchRiders.map(rider => (
                <div key={rider.id} onClick={() => setSelectedRider(rider)} className="bg-white p-6 rounded-lg shadow-md border-b-4 border-blue-500 cursor-pointer hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                        <div className="bg-blue-50 p-3 rounded-full"><UserGroupIcon className="h-6 w-6 text-blue-500"/></div>
                        <span className="text-xs font-bold px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">{rider.name}</h3>
                    <p className="text-sm text-gray-500">Rider #00{rider.id}</p>
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs font-bold text-gray-600">
                        <span>Run: 4 Headgates</span>
                        <span className="text-blue-600">View Details →</span>
                    </div>
                </div>
            ))}
        </div>
    );
  };

  const renderAdmin = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-300">
        {/* Lateral Manager */}
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <DocumentReportIcon className="h-6 w-6 mr-2 text-blue-600"/>
                Lateral Management
            </h3>
            <form onSubmit={handleAddLateral} className="flex gap-2 mb-6">
                <input value={newLatId} onChange={e => setNewLatId(e.target.value)} placeholder="ID (e.g. L1)" className="flex-1 px-3 py-2 border rounded" />
                <input value={newLatName} onChange={e => setNewLatName(e.target.value)} placeholder="Name (e.g. Lateral A)" className="flex-1 px-3 py-2 border rounded" />
                <button type="submit" className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700"><PlusIcon className="h-5 w-5"/></button>
            </form>
            <div className="space-y-2">
                {laterals.map(l => (
                    <div key={l.id} className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-100">
                        <span className="font-bold text-gray-700">{l.name} <span className="text-xs text-gray-400">({l.id})</span></span>
                        <button className="text-red-400 hover:text-red-600"><TrashIcon className="h-4 w-4"/></button>
                    </div>
                ))}
            </div>
        </div>

        {/* Headgate Manager */}
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
                <RefreshIcon className="h-6 w-6 mr-2 text-green-600"/>
                Headgate Configuration
            </h3>
            <form onSubmit={handleAddHeadgate} className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-2">
                    <input value={newHGId} onChange={e => setNewHGId(e.target.value)} placeholder="HG ID" className="px-3 py-2 border rounded" />
                    <input value={newHGName} onChange={e => setNewHGName(e.target.value)} placeholder="HG Name" className="px-3 py-2 border rounded" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <select value={newHGLat} onChange={e => setNewHGLat(e.target.value)} className="px-3 py-2 border rounded">
                        <option value="">Choose Lateral...</option>
                        {laterals.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <input value={newHGTap} onChange={e => setNewHGTap(e.target.value)} placeholder="Tap #" className="px-3 py-2 border rounded" />
                </div>
                <button type="submit" className="w-full bg-green-600 text-white py-2 rounded font-bold hover:bg-green-700">Add Headgate to Lateral</button>
            </form>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {headgates.map(h => (
                    <div key={h.id} className="p-3 bg-gray-50 rounded border border-gray-100">
                        <div className="flex justify-between items-start">
                            <span className="font-bold text-gray-800">{h.name}</span>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">Lat: {laterals.find(l => l.id === h.lateralId)?.name || 'ERR'}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Tap: {h.tapNumber}</p>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Water Office Control</h1>
            <p className="text-gray-500">Centralized District Management & System Configuration</p>
        </div>
        <div className="flex bg-white rounded-lg shadow-sm p-1 border border-gray-200">
            <button 
                onClick={() => { setActiveTab('overview'); setSelectedRider(null); }} 
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                Overview
            </button>
            <button 
                onClick={() => { setActiveTab('riders'); setSelectedRider(null); }} 
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'riders' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                Ditch Riders
            </button>
            <button 
                onClick={() => { setActiveTab('admin'); setSelectedRider(null); }} 
                className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'admin' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                System Admin
            </button>
        </div>
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'riders' && renderRiders()}
      {activeTab === 'admin' && renderAdmin()}
    </div>
  );
};

export default WaterOfficeDashboard;
