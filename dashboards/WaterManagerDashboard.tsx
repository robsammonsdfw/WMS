
import React, { useState, useEffect } from 'react';
import { User, Field, WaterOrder, WaterOrderStatus, WaterOrderType, Lateral, Headgate, WaterAccount } from '../types';
import DashboardCard from '../components/DashboardCard';
import WaterOrderList from '../components/WaterOrderList';
import SeasonStatistics from '../components/SeasonStatistics';
import FieldDetailsModal from '../components/FieldDetailsModal';
import { 
    WaterDropIcon, DocumentReportIcon, ChartBarIcon, QrCodeIcon, 
    RefreshIcon, ChartBarIcon as ViewGridIcon, TrashIcon, UserGroupIcon
} from '../components/icons';
import QRCodeModal from '../components/QRCodeModal';
import NewWaterOrderModal from '../components/NewWaterOrderModal';
import Scanner from '../components/Scanner';
import RemainingFeedView from '../components/RemainingFeedView';
import WaterUsageAlertModal from '../components/WaterUsageAlertModal';
import { 
    createWaterOrder, updateWaterOrder, resetDatabase, 
    getLaterals, getHeadgates, createField, deleteField, 
    getWaterAccounts, createWaterAccount 
} from '../services/api';

interface WaterManagerDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
  fields: Field[];
  refreshWaterOrders: () => Promise<void>;
  refreshFields: () => Promise<void>;
}

type ViewMode = 'standard' | 'feed' | 'admin' | 'accounts';

const WaterManagerDashboard: React.FC<WaterManagerDashboardProps> = ({ user, waterOrders, fields, refreshWaterOrders, refreshFields }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [selectedFieldForQR, setSelectedFieldForQR] = useState<Field | null>(null);
  const [selectedFieldDetails, setSelectedFieldDetails] = useState<Field | null>(null);
  const [alertField, setAlertField] = useState<Field | null>(null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [createOrderInitialFieldId, setCreateOrderInitialFieldId] = useState<string | undefined>(undefined);
  const [createOrderType, setCreateOrderType] = useState<WaterOrderType>(WaterOrderType.TurnOn);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [now, setNow] = useState(new Date());
  
  const [isLoadingAdmin, setIsLoadingAdmin] = useState(false);
  const [accounts, setAccounts] = useState<WaterAccount[]>([]);

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
  const [newPrimaryAccount, setNewPrimaryAccount] = useState('');
  
  // New "Direct Typed" Infrastructure States
  const [newTypedLateral, setNewTypedLateral] = useState('');
  const [newTypedHeadgate, setNewTypedHeadgate] = useState('');

  // Account Registry States
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccOwner, setNewAccOwner] = useState('');
  const [newAccAllotment, setNewAccAllotment] = useState('');

  // Timer for real-time updates
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Fetch accounts whenever viewing admin or accounts, or for modal population
    fetchAccounts();
  }, [viewMode]);

  const fetchAccounts = async () => {
      try {
          const accs = await getWaterAccounts();
          setAccounts(accs);
      } catch(e) { console.error(e); }
  };

  useEffect(() => {
    if (viewMode === 'admin') fetchAdminData();
  }, [viewMode]);

  const fetchAdminData = async () => {
    setIsLoadingAdmin(true);
    try {
      await Promise.all([getLaterals(), getHeadgates()]);
    } catch (e) { console.error(e); } finally { setIsLoadingAdmin(false); }
  };

  useEffect(() => {
    const checkForAlerts = () => {
        const fieldWithAlert = fields.find(f => {
            const activeAccount = f.accounts?.find(a => a.isActive);
            if (activeAccount?.allocationForField && activeAccount.usageForField) {
                 const percent = (Number(activeAccount.usageForField) / Number(activeAccount.allocationForField));
                 return percent >= 0.75 && percent < 1.0 && !f.accounts.some(a => a.isQueued);
            }
            return false; 
        });
        if (fieldWithAlert) setAlertField(fieldWithAlert);
    };
    const timer = setTimeout(checkForAlerts, 1000);
    return () => clearTimeout(timer);
  }, [fields]);

  // Helper to Calculate Real-Time Usage per Field
  const calculateFieldStats = (field: Field) => {
    const fieldOrders = waterOrders.filter(o => o.fieldId === field.id);
    const calculatedTotalUsage = fieldOrders.reduce((sum, order) => {
        const rate = (order.requestedInches || (order.requestedAmount * 25)) / 25;
        let duration = 0;
        
        const startParts = order.deliveryStartDate.split('-');
        const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));

        if (order.status === WaterOrderStatus.InProgress) {
            duration = Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        } else if (order.status === WaterOrderStatus.Completed && order.deliveryEndDate) {
            const endParts = order.deliveryEndDate.split('-');
            const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
            // Use inclusive date logic (+1 day) for completed orders to ensure usage isn't zeroed out
            duration = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
        return sum + (duration * rate);
    }, 0);

    const used = Math.max(Number(field.waterUsed || 0), calculatedTotalUsage);
    const total = Number(field.totalWaterAllocation) || 0;
    const remaining = Math.max(0, total - used);
    
    return { used, total, remaining };
  };

  // Helper to Calculate Real-Time Usage per ACCOUNT
  const calculateAccountStats = (account: WaterAccount) => {
      // Find orders tagged with this account number
      const accountOrders = waterOrders.filter(o => o.accountNumber === account.accountNumber);
      
      const usage = accountOrders.reduce((sum, order) => {
        const rate = (order.requestedInches || (order.requestedAmount * 25)) / 25;
        let duration = 0;
        const startParts = order.deliveryStartDate.split('-');
        const start = new Date(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2]));

        if (order.status === WaterOrderStatus.InProgress) {
             duration = Math.max(0, (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        } else if (order.status === WaterOrderStatus.Completed && order.deliveryEndDate) {
             const endParts = order.deliveryEndDate.split('-');
             const end = new Date(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2]));
             duration = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        }
        return sum + (duration * rate);
      }, 0);

      const total = Number(account.totalAllotment) || 0;
      return { used: usage, total, remaining: Math.max(0, total - usage) };
  };

  // Aggregated Stats
  const totalWaterUsed = fields.reduce((sum, field) => sum + calculateFieldStats(field).used, 0);
  const totalAllocation = fields.reduce((sum, field) => sum + (Number(field.totalWaterAllocation) || 0), 0);
  const allocationUsedPercent = totalAllocation > 0 ? ((totalWaterUsed / totalAllocation) * 100).toFixed(1) : "0";

  const awaitingApprovalOrders = waterOrders.filter(o => o.status === WaterOrderStatus.AwaitingApproval);
  const myRecentOrders = waterOrders.filter(o => o.requester === user.name || awaitingApprovalOrders.some(aao => aao.id === o.id));

  const handleResetDb = async () => {
    if (window.confirm("Are you sure you want to reset the entire database? This cannot be undone.")) {
      try {
        await resetDatabase();
        await refreshWaterOrders();
        await refreshFields();
        setAccounts([]);
        alert("Database reset successfully.");
        window.location.reload(); 
      } catch (err: any) {
        alert("Reset failed: " + (err.message || "Unknown error"));
      }
    }
  };

  const handleDeleteSingleField = async (e: React.MouseEvent, fieldId: string, fieldName: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the field registry for "${fieldName}"? This will also remove its water order history.`)) {
        try {
            await deleteField(fieldId);
            await refreshFields();
            await refreshWaterOrders();
            alert(`Field "${fieldName}" deleted.`);
        } catch (err: any) {
            alert("Delete failed: " + (err.message || "Unknown error"));
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
            headgateIds: newTypedHeadgate ? [newTypedHeadgate] : [],
            primaryAccountNumber: newPrimaryAccount
        });
        
        // Reset states
        setNewFieldId(''); setNewFieldName(''); setNewCompName(''); setNewAddr(''); setNewPhone(''); 
        setNewFieldCrop(''); setNewFieldAcres(''); setNewFieldOwner(''); setNewFieldAlloc(''); 
        setNewFieldAllotment(''); setNewLatCoord(''); setNewLngCoord('');
        setNewTypedLateral(''); setNewTypedHeadgate(''); setNewPrimaryAccount('');

        await refreshFields(); 
        alert("Field Registry profile created.");
    } catch (err: any) { alert(err.message); }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newAccNumber || !newAccOwner) return alert("Account Number and Owner required");
      try {
          await createWaterAccount({
              accountNumber: newAccNumber,
              ownerName: newAccOwner,
              totalAllotment: parseFloat(newAccAllotment) || 0
          });
          setNewAccNumber(''); setNewAccOwner(''); setNewAccAllotment('');
          await fetchAccounts();
          alert("Account Created.");
      } catch (e: any) { alert(e.message); }
  };

  const handleManualOrderCreate = async (orderData: { 
    fieldId: string; 
    orderType: WaterOrderType; 
    requestedAmount: number; 
    deliveryStartDate: string; 
    deliveryEndDate?: string;
    accountNumber?: string;
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
        headgateId: field.headgateIds?.[0] || '',
        accountNumber: orderData.accountNumber // Pass account number to backend
      });

      setIsNewOrderModalOpen(false);
      await refreshWaterOrders();
      alert("Water order submitted. Awaiting verification.");
    } catch (err: any) {
      alert("Failed to create order: " + (err.message || "Unknown error"));
    }
  };

  const renderAccountsView = () => (
      <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-300 pb-20">
          {/* Add Account Form */}
           <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">
                <div className="bg-emerald-900 p-8 text-white">
                    <h3 className="text-2xl font-black uppercase tracking-tight">Water Bank Ledger</h3>
                    <p className="text-emerald-200 font-bold text-sm">Manage Account Allotments and Balance</p>
                </div>
                <div className="p-8">
                     <form onSubmit={handleCreateAccount} className="space-y-6 bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Account Number</label>
                                <input value={newAccNumber} onChange={e => setNewAccNumber(e.target.value)} placeholder="ACCT-2024-001" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Owner Name</label>
                                <input value={newAccOwner} onChange={e => setNewAccOwner(e.target.value)} placeholder="Entity Name" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
                            </div>
                             <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Total Allotment (AF)</label>
                                <input type="number" value={newAccAllotment} onChange={e => setNewAccAllotment(e.target.value)} placeholder="1000.00" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
                            </div>
                        </div>
                        <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black uppercase text-sm hover:bg-emerald-700 shadow-xl transition-all">Create Account Ledger</button>
                     </form>
                </div>
           </div>

           {/* Accounts List */}
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {accounts.map(acc => {
                   const stats = calculateAccountStats(acc);
                   return (
                       <div key={acc.accountNumber} className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100 relative overflow-hidden group">
                           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                               <DocumentReportIcon className="h-24 w-24 text-emerald-900" />
                           </div>
                           <h4 className="text-2xl font-black text-gray-900">{acc.accountNumber}</h4>
                           <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">{acc.ownerName}</p>
                           
                           <div className="space-y-4">
                               <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                   <span className="text-xs font-black text-gray-400 uppercase">Total Cash (Allotment)</span>
                                   <span className="text-xl font-black text-gray-900">{stats.total.toFixed(2)} AF</span>
                               </div>
                               <div className="flex justify-between items-end border-b border-gray-100 pb-2">
                                   <span className="text-xs font-black text-gray-400 uppercase">Spent (Used)</span>
                                   <span className="text-xl font-black text-red-500">{stats.used.toFixed(2)} AF</span>
                               </div>
                               <div className="flex justify-between items-end">
                                   <span className="text-xs font-black text-gray-400 uppercase">Available Balance</span>
                                   <span className="text-2xl font-black text-emerald-600">{stats.remaining.toFixed(2)} AF</span>
                               </div>
                           </div>
                       </div>
                   )
               })}
           </div>
      </div>
  );

  const renderAdminView = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-300 pb-20">
        <div className="bg-white rounded-[2rem] shadow-2xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-900 p-8 text-white flex justify-between items-center">
                <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Infrastructure Command Center</h3>
                    <p className="text-gray-400 font-bold text-sm">Register Fields and Direct-Type Asset Mapping</p>
                </div>
                {isLoadingAdmin && <RefreshIcon className="h-6 w-6 animate-spin text-blue-400" />}
            </div>

            <div className="p-8 space-y-12">
                <div className="space-y-6">
                    <div className="flex items-center space-x-3 text-indigo-600">
                        <ViewGridIcon className="h-6 w-6" />
                        <h4 className="text-lg font-black uppercase tracking-widest">Unified Field Profile Registry</h4>
                    </div>
                    
                    <form onSubmit={handleAddField} className="space-y-8 bg-indigo-50/50 p-8 rounded-[2.5rem] border border-indigo-100 shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Field ID</label>
                                <input value={newFieldId} onChange={e => setNewFieldId(e.target.value)} placeholder="F-001" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Display Name</label>
                                <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="e.g. SOUTH 40" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Company Name</label>
                                <input value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="Farming Co." className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Phone</label>
                                <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="555-0101" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Address</label>
                                <input value={newAddr} onChange={e => setNewAddr(e.target.value)} placeholder="123 Field Lane" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Crop Type</label>
                                    <input value={newFieldCrop} onChange={e => setNewFieldCrop(e.target.value)} placeholder="Corn" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Acres</label>
                                    <input type="number" value={newFieldAcres} onChange={e => setNewFieldAcres(e.target.value)} placeholder="100" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Owner Name</label>
                                <input value={newFieldOwner} onChange={e => setNewFieldOwner(e.target.value)} placeholder="John Doe" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            {/* Legacy Allocation Fields - Optional if using Accounts */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Season AF (Legacy)</label>
                                <input type="number" value={newFieldAlloc} onChange={e => setNewFieldAlloc(e.target.value)} placeholder="400" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Current Allotment AF (Legacy)</label>
                                <input type="number" value={newFieldAllotment} onChange={e => setNewFieldAllotment(e.target.value)} placeholder="250" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lat</label>
                                    <input value={newLatCoord} onChange={e => setNewLatCoord(e.target.value)} placeholder="43.0" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lng</label>
                                    <input value={newLngCoord} onChange={e => setNewLngCoord(e.target.value)} placeholder="-116.0" className="w-full px-4 py-3 border border-gray-200 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-indigo-100">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1 tracking-widest">Primary Lateral Name (Direct Type)</label>
                                <input value={newTypedLateral} onChange={e => setNewTypedLateral(e.target.value)} placeholder="e.g. Lateral 8.13" className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl font-black text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                                <p className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Enter the Rider Channel or Lateral ID</p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-indigo-600 uppercase ml-1 tracking-widest">Primary Headgate / Tap ID (Direct Type)</label>
                                <input value={newTypedHeadgate} onChange={e => setNewTypedHeadgate(e.target.value)} placeholder="e.g. HG-A" className="w-full px-4 py-3 border-2 border-indigo-200 rounded-xl font-black text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none bg-white" />
                                <p className="text-[9px] font-bold text-gray-400 ml-1 uppercase">Enter the main tap point ID</p>
                            </div>
                            {/* New Account Input */}
                             <div className="space-y-1 col-span-1 md:col-span-2 mt-4">
                                <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">Primary Account Number (Billing)</label>
                                <input value={newPrimaryAccount} onChange={e => setNewPrimaryAccount(e.target.value)} placeholder="e.g. ACCT-12345" className="w-full px-4 py-3 border-2 border-emerald-200 rounded-xl font-black text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none bg-white" />
                                <p className="text-[9px] font-bold text-gray-400 ml-1 uppercase">The bank account that holds the water allotment</p>
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase text-sm hover:bg-indigo-700 shadow-xl transition-all">Register Field profile</button>
                    </form>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {fields.map(f => (
                <div key={f.id} onClick={() => setSelectedFieldDetails(f)} className="bg-white p-6 rounded-3xl shadow-lg border border-gray-100 hover:border-indigo-200 transition-colors cursor-pointer group relative">
                    <button 
                        onClick={(e) => handleDeleteSingleField(e, f.id, f.name)}
                        className="absolute top-4 right-4 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100"
                        title="Delete Field Registry"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                    <div className="flex justify-between items-start mb-2 pr-8">
                        <p className="font-black text-gray-900 text-lg group-hover:text-indigo-600 transition-colors">{f.name}</p>
                    </div>
                    <span className="text-[8px] font-black bg-gray-100 px-2 py-0.5 rounded uppercase">{f.id}</span>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2">{f.companyName || f.owner || 'Farmer'}</p>
                    <div className="mt-4 flex gap-2">
                        <div className="px-2 py-1 bg-blue-50 text-[9px] font-black text-blue-600 rounded-lg uppercase">Lat: {f.lateral || 'Direct'}</div>
                        <div className="px-2 py-1 bg-green-50 text-[9px] font-black text-green-600 rounded-lg uppercase">HG: {f.tapNumber || 'Direct'}</div>
                    </div>
                     <div className="mt-2">
                         <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-1 rounded-lg block text-center">
                             ACCT: {f.primaryAccountNumber || 'Unassigned'}
                         </span>
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
            <button onClick={() => setViewMode('accounts')} className={`px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'accounts' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-gray-500'}`}>Accounts</button>
            <button onClick={() => setViewMode('admin')} className={`px-6 py-2.5 rounded-[1.5rem] text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'admin' ? 'bg-white text-blue-600 shadow-md scale-105' : 'text-gray-500'}`}>Infrastructure</button>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsScannerOpen(true)} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 uppercase tracking-widest shadow-lg shadow-indigo-100"><QrCodeIcon className="-ml-1 mr-2 h-4 w-4" /> Scan Tag</button>
            <button onClick={handleResetDb} className="inline-flex items-center px-4 py-2 border border-transparent text-xs font-black rounded-xl text-white bg-red-600 hover:bg-red-700 uppercase tracking-widest shadow-lg shadow-red-100"><TrashIcon className="-ml-1 mr-2 h-4 w-4" /> Reset DB</button>
          </div>
      </div>
      
      {viewMode === 'admin' ? renderAdminView() : viewMode === 'accounts' ? renderAccountsView() : viewMode === 'feed' ? (
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
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Account</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Balance</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {fields.map(field => {
                                const stats = calculateFieldStats(field);
                                return (
                                <tr key={field.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedFieldDetails(field)}>
                                    <td className="px-6 py-4 whitespace-nowrap font-black text-gray-900">{field.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{field.primaryAccountNumber || '—'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap font-black text-blue-600">{stats.remaining.toFixed(1)} / {stats.total.toFixed(1)} AF</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center gap-4">
                                            <button onClick={(e) => { e.stopPropagation(); setSelectedFieldForQR(field); }} className="text-blue-600 hover:text-blue-800 font-bold uppercase text-[10px] flex items-center gap-1">
                                                <QrCodeIcon className="h-4 w-4" /> QR Codes
                                            </button>
                                            <button onClick={(e) => handleDeleteSingleField(e, field.id, field.name)} className="text-red-500 hover:text-red-700 font-bold uppercase text-[10px] flex items-center gap-1">
                                                <TrashIcon className="h-4 w-4" /> Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </div>
            <WaterOrderList orders={myRecentOrders} title="Command History" />
        </>
      )}

      {alertField && <WaterUsageAlertModal field={alertField} onClose={() => setAlertField(null)} onUpdate={refreshWaterOrders} />}
      {selectedFieldForQR && <QRCodeModal field={selectedFieldForQR} onClose={() => setSelectedFieldForQR(null)} />}
      {selectedFieldDetails && <FieldDetailsModal field={selectedFieldDetails} orders={waterOrders} onClose={() => setSelectedFieldDetails(null)} onUpdate={refreshFields} onCreateOrder={(type) => { setCreateOrderInitialFieldId(selectedFieldDetails.id); setCreateOrderType(type); setIsNewOrderModalOpen(true); }} />}
      {isNewOrderModalOpen && <NewWaterOrderModal fields={fields} initialFieldId={createOrderInitialFieldId} initialOrderType={createOrderType} onClose={() => setIsNewOrderModalOpen(false)} onOrderCreate={handleManualOrderCreate} />}
      {isScannerOpen && <Scanner onScan={handleIrrigatorScan} onClose={() => setIsScannerOpen(false)} />}
    </div>
  );
};

export default WaterManagerDashboard;
