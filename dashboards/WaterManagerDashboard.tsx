import React, { useState, useEffect } from 'react';
import { 
    User, Field, WaterOrder, WaterOrderStatus, WaterOrderType, 
    Lateral, Headgate, WaterAccount, AccountAlert, AlertType 
} from '../types';
import DashboardCard from '../components/DashboardCard';
import WaterOrderList from '../components/WaterOrderList';
import SeasonStatistics from '../components/SeasonStatistics';
import FieldDetailsModal from '../components/FieldDetailsModal';
import { 
    WaterDropIcon, DocumentReportIcon, ChartBarIcon, QrCodeIcon, 
    RefreshIcon, ChartBarIcon as ViewGridIcon, TrashIcon, UserGroupIcon, PlusIcon, XCircleIcon
} from '../components/icons';
import QRCodeModal from '../components/QRCodeModal';
import NewWaterOrderModal from '../components/NewWaterOrderModal';
import Scanner from '../components/Scanner';
import RemainingFeedView from '../components/RemainingFeedView';
import WaterUsageAlertModal from '../components/WaterUsageAlertModal';
import { 
    createWaterOrder, updateWaterOrder, resetDatabase, 
    getLaterals, getHeadgates, createField, deleteField, 
    getWaterAccounts, createWaterAccount,
    getAlerts, createAlerts, updateAlert, deleteAlert
} from '../services/api';

interface WaterManagerDashboardProps {
  user: User;
  waterOrders: WaterOrder[];
  fields: Field[];
  refreshWaterOrders: () => Promise<void>;
  refreshFields: () => Promise<void>;
}

type ViewMode = 'standard' | 'feed' | 'admin' | 'accounts';
type AdminTab = 'registry' | 'alerts';

const WaterManagerDashboard: React.FC<WaterManagerDashboardProps> = ({ user, waterOrders, fields, refreshWaterOrders, refreshFields }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [adminTab, setAdminTab] = useState<AdminTab>('registry');
  
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
  const [alerts, setAlerts] = useState<AccountAlert[]>([]);
  const [unacknowledgedAlerts, setUnacknowledgedAlerts] = useState<AccountAlert[]>([]);

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
  const [newTypedLateral, setNewTypedLateral] = useState('');
  const [newTypedHeadgate, setNewTypedHeadgate] = useState('');
  const [isEditingField, setIsEditingField] = useState(false);

  // Account Registry States
  const [newAccNumber, setNewAccNumber] = useState('');
  const [newAccOwner, setNewAccOwner] = useState('');
  const [newAccAllotment, setNewAccAllotment] = useState('');

  // Alerts Form States
  const [alertAccount, setAlertAccount] = useState<string>(''); // 'ALL' for bulk
  const [alertType, setAlertType] = useState<AlertType>(AlertType.Both);
  const [alertThreshold, setAlertThreshold] = useState<number>(10);
  const [showAllThresholds, setShowAllThresholds] = useState(false);

  // Timer for real-time updates
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchAlertsData();
  }, [viewMode]);

  useEffect(() => {
    if (viewMode === 'admin') fetchAdminData();
  }, [viewMode]);

  const fetchAccounts = async () => {
      try {
          const accs = await getWaterAccounts();
          setAccounts(accs);
      } catch(e) { console.error(e); }
  };

  const fetchAlertsData = async () => {
      try {
          const a = await getAlerts();
          setAlerts(a);
      } catch(e) { console.error(e); }
  };

  const fetchAdminData = async () => {
    setIsLoadingAdmin(true);
    try {
      await Promise.all([getLaterals(), getHeadgates(), fetchAlertsData()]);
    } catch (e) { console.error(e); } finally { setIsLoadingAdmin(false); }
  };

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

  // Global Alert Acknowledgement Trigger
  useEffect(() => {
    const triggered: AccountAlert[] = [];
    alerts.forEach(alert => {
        if (alert.isAcknowledged) return;
        
        const acc = accounts.find(a => a.accountNumber === alert.accountNumber);
        if (!acc) return;
        
        const linkedFields = fields.filter(f => f.primaryAccountNumber === alert.accountNumber);
        let isTriggered = false;
        
        if (alert.alertType === AlertType.Allotment || alert.alertType === AlertType.Both) {
            const stats = calculateAccountStats(acc);
            if (stats.total > 0) {
                const remainingPct = (stats.remaining / stats.total) * 100;
                if (remainingPct <= alert.thresholdPercent) isTriggered = true;
            }
        }
        if (alert.alertType === AlertType.Allocation || alert.alertType === AlertType.Both) {
            linkedFields.forEach(f => {
                const fStats = calculateFieldStats(f);
                if (fStats.total > 0) {
                    const remainingPct = (fStats.remaining / fStats.total) * 100;
                    if (remainingPct <= alert.thresholdPercent) isTriggered = true;
                }
            });
        }

        if (isTriggered) {
            triggered.push(alert);
        }
    });
    
    // Only update state if IDs changed to prevent infinite re-renders
    const currentIds = unacknowledgedAlerts.map(a => a.id).sort().join(',');
    const newIds = triggered.map(a => a.id).sort().join(',');
    
    if (currentIds !== newIds) {
        setUnacknowledgedAlerts(triggered);
    }
  }, [alerts, accounts, fields, waterOrders, now]);

  const handleAcknowledgeAlert = async (alertId: string) => {
      try {
          await updateAlert(alertId, { isAcknowledged: true });
          await fetchAlertsData();
      } catch (e: any) { alert("Failed to acknowledge: " + e.message); }
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
        setAlerts([]);
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

  const handleEditField = (field: Field) => {
    setNewFieldId(field.id); setNewFieldName(field.name); setNewCompName(field.companyName || '');
    setNewAddr(field.address || ''); setNewPhone(field.phone || ''); setNewFieldCrop(field.crop);
    setNewFieldAcres(field.acres.toString()); setNewFieldOwner(field.owner || ''); setNewFieldAlloc(field.totalWaterAllocation.toString());
    setNewFieldAllotment(field.waterAllotment?.toString() || ''); setNewLatCoord(field.lat?.toString() || ''); setNewLngCoord(field.lng?.toString() || '');
    setNewTypedLateral(field.lateral || ''); setNewTypedHeadgate(field.tapNumber || ''); setNewPrimaryAccount(field.primaryAccountNumber || '');
    setIsEditingField(true);
    setAdminTab('registry'); // Ensure we are on registry tab if clicking from outside
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleClearForm = (e?: React.MouseEvent) => {
    if(e) e.preventDefault();
    setNewFieldId(''); setNewFieldName(''); setNewCompName(''); setNewAddr(''); setNewPhone(''); 
    setNewFieldCrop(''); setNewFieldAcres(''); setNewFieldOwner(''); setNewFieldAlloc(''); 
    setNewFieldAllotment(''); setNewLatCoord(''); setNewLngCoord('');
    setNewTypedLateral(''); setNewTypedHeadgate(''); setNewPrimaryAccount('');
    setIsEditingField(false);
  };

  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldId || !newFieldName) return alert("Field ID and Name required.");
    try {
        await createField({ 
            id: newFieldId, name: newFieldName, companyName: newCompName, address: newAddr, phone: newPhone, crop: newFieldCrop, 
            acres: parseFloat(newFieldAcres) || 0, totalWaterAllocation: parseFloat(newFieldAlloc) || 0, waterAllotment: parseFloat(newFieldAllotment) || 0,
            lat: parseFloat(newLatCoord), lng: parseFloat(newLngCoord), owner: newFieldOwner, lateral: newTypedLateral, tapNumber: newTypedHeadgate,
            headgateIds: newTypedHeadgate ? [newTypedHeadgate] : [], primaryAccountNumber: newPrimaryAccount
        });
        handleClearForm();
        await refreshFields(); 
        alert(isEditingField ? "Field Profile Updated." : "Field Registry profile created.");
    } catch (err: any) { alert(err.message); }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newAccNumber || !newAccOwner) return alert("Account Number and Owner required");
      try {
          await createWaterAccount({ accountNumber: newAccNumber, ownerName: newAccOwner, totalAllotment: parseFloat(newAccAllotment) || 0 });
          setNewAccNumber(''); setNewAccOwner(''); setNewAccAllotment('');
          await fetchAccounts();
          alert("Account Created.");
      } catch (e: any) { alert(e.message); }
  };

  const handleCreateAlert = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!alertAccount) return alert("Please select an account or Bulk option.");
      try {
          const payload: Partial<AccountAlert>[] = [];
          if (alertAccount === 'ALL') {
              accounts.forEach(acc => {
                  payload.push({ accountNumber: acc.accountNumber, alertType, thresholdPercent: alertThreshold });
              });
          } else {
              payload.push({ accountNumber: alertAccount, alertType, thresholdPercent: alertThreshold });
          }
          await createAlerts(payload);
          await fetchAlertsData();
          alert("Alert(s) successfully created.");
          setAlertAccount('');
          setAlertThreshold(10);
      } catch (e: any) { alert("Failed to create alert: " + e.message); }
  };

  const handleDeleteAlert = async (id: string) => {
      if (window.confirm("Delete this alert?")) {
          try {
              await deleteAlert(id);
              await fetchAlertsData();
          } catch(e: any) { alert(e.message); }
      }
  };

  const handleManualOrderCreate = async (orderData: { fieldId: string; orderType: WaterOrderType; requestedAmount: number; deliveryStartDate: string; deliveryEndDate?: string; accountNumber?: string; }) => {
    try {
      const field = fields.find(f => f.id === orderData.fieldId);
      if (!field) throw new Error("Field not found in registry.");
      await createWaterOrder({
        ...orderData, fieldName: field.name, requester: user.name, status: WaterOrderStatus.AwaitingApproval,
        orderDate: new Date().toISOString().split('T')[0], lateralId: field.lateral || '', tapNumber: field.tapNumber || '',
        headgateId: field.headgateIds?.[0] || '', accountNumber: orderData.accountNumber
      });
      setIsNewOrderModalOpen(false);
      await refreshWaterOrders();
      alert("Water order submitted. Awaiting verification.");
    } catch (err: any) { alert("Failed to create order: " + (err.message || "Unknown error")); }
  };

  const renderAccountsView = () => (
      <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-300 pb-20">
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

  const renderAlertsView = () => {
      // Create options: 0% to 30%, or 0% to 100%
      const thresholds = showAllThresholds 
          ? Array.from({length: 21}, (_, i) => i * 5)
          : Array.from({length: 7}, (_, i) => i * 5);

      return (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
               <div className="bg-white rounded-[2rem] shadow-2xl border border-rose-100 overflow-hidden">
                    <div className="bg-rose-600 p-8 text-white">
                        <h3 className="text-2xl font-black uppercase tracking-tight">System Alerts Configuration</h3>
                        <p className="text-rose-200 font-bold text-sm">Monitor Allowance and Allotment Usage Thresholds</p>
                    </div>
                    
                    <div className="p-8">
                         <form onSubmit={handleCreateAlert} className="space-y-6 bg-rose-50/50 p-8 rounded-[2.5rem] border border-rose-100 shadow-sm">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-rose-900 uppercase ml-1">Target Account</label>
                                    <select value={alertAccount} onChange={e => setAlertAccount(e.target.value)} className="w-full px-4 py-3 border border-rose-200 rounded-xl font-bold focus:ring-2 focus:ring-rose-500 outline-none bg-white">
                                        <option value="" disabled>Select an account...</option>
                                        <option value="ALL" className="font-black text-rose-600">⚡ Bulk Set All Accounts ⚡</option>
                                        {accounts.map(acc => (
                                            <option key={acc.accountNumber} value={acc.accountNumber}>{acc.accountNumber} - {acc.ownerName}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-rose-900 uppercase ml-1">Alert Trigger Focus</label>
                                    <select value={alertType} onChange={e => setAlertType(e.target.value as AlertType)} className="w-full px-4 py-3 border border-rose-200 rounded-xl font-bold focus:ring-2 focus:ring-rose-500 outline-none bg-white">
                                        <option value={AlertType.Allotment}>Allotment Only</option>
                                        <option value={AlertType.Allocation}>Allowance Only</option>
                                        <option value={AlertType.Both}>Alert on Both</option>
                                    </select>
                                </div>
                                 <div className="space-y-1">
                                    <label className="text-[10px] font-black text-rose-900 uppercase ml-1">Threshold Percentage (%)</label>
                                    <div className="flex gap-2">
                                        <select value={alertThreshold} onChange={e => setAlertThreshold(Number(e.target.value))} className="flex-1 px-4 py-3 border border-rose-200 rounded-xl font-bold focus:ring-2 focus:ring-rose-500 outline-none bg-white">
                                            {thresholds.map(t => (
                                                <option key={t} value={t}>{t}% Remaining</option>
                                            ))}
                                        </select>
                                        {!showAllThresholds && (
                                            <button type="button" onClick={() => setShowAllThresholds(true)} className="px-4 py-3 bg-rose-100 text-rose-700 rounded-xl font-black text-xs hover:bg-rose-200 transition-colors whitespace-nowrap">
                                                Show All %
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-rose-600 text-white py-4 rounded-xl font-black uppercase text-sm hover:bg-rose-700 shadow-xl transition-all">Register New Alert Level</button>
                         </form>
                    </div>
               </div>

               <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-gray-100">
                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight mb-6">Active Threshold Monitors</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Account Target</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Monitor Type</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Trigger Level</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {alerts.length === 0 ? (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-sm font-bold text-gray-400 uppercase tracking-widest">No alerts registered</td></tr>
                                ) : alerts.map(alert => (
                                    <tr key={alert.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-black text-gray-900">{alert.accountNumber}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold uppercase text-gray-600">
                                            {alert.alertType === AlertType.Allocation ? 'Allowance' : alert.alertType}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap font-black text-rose-600">{alert.thresholdPercent}% Remaining</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {alert.isAcknowledged ? 
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">Acknowledged</span> : 
                                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase animate-pulse">Monitoring</span>
                                            }
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <button onClick={() => handleDeleteAlert(alert.id)} className="text-red-500 hover:text-red-700 font-bold uppercase text-[10px] flex items-center gap-1">
                                                <TrashIcon className="h-4 w-4" /> Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
               </div>
          </div>
      );
  };

  const renderRegistryView = () => (
      <div className="space-y-8 animate-in slide-in-from-left-4 duration-300">
        <form onSubmit={handleAddField} className={`space-y-8 p-8 rounded-[2.5rem] border shadow-sm transition-colors ${isEditingField ? 'bg-orange-50/50 border-orange-100' : 'bg-indigo-50/50 border-indigo-100'}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Field ID</label>
                    <input value={newFieldId} onChange={e => setNewFieldId(e.target.value)} placeholder="F-001" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500 bg-white' : 'border-gray-200 focus:ring-indigo-500'}`} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Display Name</label>
                    <input value={newFieldName} onChange={e => setNewFieldName(e.target.value)} placeholder="e.g. SOUTH 40" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Company Name</label>
                    <input value={newCompName} onChange={e => setNewCompName(e.target.value)} placeholder="Farming Co." className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Phone</label>
                    <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="555-0101" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Address</label>
                    <input value={newAddr} onChange={e => setNewAddr(e.target.value)} placeholder="123 Field Lane" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Crop Type</label>
                        <input value={newFieldCrop} onChange={e => setNewFieldCrop(e.target.value)} placeholder="Corn" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Acres</label>
                        <input type="number" value={newFieldAcres} onChange={e => setNewFieldAcres(e.target.value)} placeholder="100" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Owner Name</label>
                    <input value={newFieldOwner} onChange={e => setNewFieldOwner(e.target.value)} placeholder="John Doe" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Season AF (Legacy)</label>
                    <input type="number" value={newFieldAlloc} onChange={e => setNewFieldAlloc(e.target.value)} placeholder="400" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Current Allotment AF (Legacy)</label>
                    <input type="number" value={newFieldAllotment} onChange={e => setNewFieldAllotment(e.target.value)} placeholder="250" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lat</label>
                        <input value={newLatCoord} onChange={e => setNewLatCoord(e.target.value)} placeholder="43.0" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Lng</label>
                        <input value={newLngCoord} onChange={e => setNewLngCoord(e.target.value)} placeholder="-116.0" className={`w-full px-4 py-3 border rounded-xl font-bold focus:ring-2 outline-none ${isEditingField ? 'border-orange-200 focus:ring-orange-500' : 'border-gray-200 focus:ring-indigo-500'}`} />
                    </div>
                </div>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t ${isEditingField ? 'border-orange-200' : 'border-indigo-100'}`}>
                <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase ml-1 tracking-widest ${isEditingField ? 'text-orange-600' : 'text-indigo-600'}`}>Primary Lateral Name (Direct Type)</label>
                    <input value={newTypedLateral} onChange={e => setNewTypedLateral(e.target.value)} placeholder="e.g. Lateral 8.13" className={`w-full px-4 py-3 border-2 rounded-xl font-black focus:ring-2 outline-none bg-white ${isEditingField ? 'border-orange-200 text-orange-900 focus:ring-orange-500' : 'border-indigo-200 text-indigo-900 focus:ring-indigo-500'}`} />
                </div>
                <div className="space-y-1">
                    <label className={`text-[10px] font-black uppercase ml-1 tracking-widest ${isEditingField ? 'text-orange-600' : 'text-indigo-600'}`}>Primary Headgate / Tap ID (Direct Type)</label>
                    <input value={newTypedHeadgate} onChange={e => setNewTypedHeadgate(e.target.value)} placeholder="e.g. HG-A" className={`w-full px-4 py-3 border-2 rounded-xl font-black focus:ring-2 outline-none bg-white ${isEditingField ? 'border-orange-200 text-orange-900 focus:ring-orange-500' : 'border-indigo-200 text-indigo-900 focus:ring-indigo-500'}`} />
                </div>
                 <div className="space-y-1 col-span-1 md:col-span-2 mt-4">
                    <label className="text-[10px] font-black text-emerald-600 uppercase ml-1 tracking-widest">Primary Account Number (Billing)</label>
                    <input value={newPrimaryAccount} onChange={e => setNewPrimaryAccount(e.target.value)} placeholder="e.g. ACCT-12345" className="w-full px-4 py-3 border-2 border-emerald-200 rounded-xl font-black text-emerald-900 focus:ring-2 focus:ring-emerald-500 outline-none bg-white" />
                </div>
            </div>

            <div className="flex gap-4">
                {isEditingField && (
                    <button type="button" onClick={handleClearForm} className="flex-1 bg-gray-200 text-gray-700 py-4 rounded-xl font-black uppercase text-sm hover:bg-gray-300 shadow-xl transition-all">
                        Cancel Edit
                    </button>
                )}
                <button type="submit" className={`flex-1 text-white py-4 rounded-xl font-black uppercase text-sm shadow-xl transition-all ${isEditingField ? 'bg-orange-600 hover:bg-orange-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                    {isEditingField ? "Update Field Profile" : "Register Field Profile"}
                </button>
            </div>
        </form>
      </div>
  );

  const renderAdminView = () => (
    <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-300 pb-20">
        <div className={`bg-white rounded-[2rem] shadow-2xl border transition-all overflow-hidden ${isEditingField ? 'border-orange-200 shadow-orange-100' : 'border-gray-100'}`}>
            <div className={`p-8 text-white flex justify-between items-center transition-colors ${isEditingField ? 'bg-orange-600' : 'bg-gray-900'}`}>
                <div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">
                        {isEditingField ? 'Update Field Profile' : 'Infrastructure Command Center'}
                    </h3>
                    <p className={`font-bold text-sm ${isEditingField ? 'text-orange-200' : 'text-gray-400'}`}>
                        {isEditingField ? 'Editing Existing Field Data' : 'Manage Field Registries and System Alerts'}
                    </p>
                </div>
                {isLoadingAdmin && <RefreshIcon className="h-6 w-6 animate-spin text-blue-400" />}
                {isEditingField && (
                    <button onClick={handleClearForm} className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2">
                        <XCircleIcon className="h-4 w-4" /> Cancel Edit
                    </button>
                )}
            </div>

            {/* Sub-Tabs for Infrastructure */}
            <div className="bg-gray-50 border-b border-gray-200 px-8 flex gap-4">
                <button 
                    onClick={() => setAdminTab('registry')}
                    className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${adminTab === 'registry' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                >
                    Unified Field Profile Registry
                </button>
                <button 
                    onClick={() => setAdminTab('alerts')}
                    className={`px-6 py-4 text-xs font-black uppercase tracking-widest border-b-4 transition-all ${adminTab === 'alerts' ? 'border-rose-600 text-rose-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
                >
                    Account Alerts
                </button>
            </div>

            <div className="p-8">
                {adminTab === 'registry' ? renderRegistryView() : renderAlertsView()}
            </div>
        </div>

        {/* The Field Grid (Always show below admin forms so user can see what they edit/alert on) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {fields.map(f => {
                // Determine Flashing State for this field
                const linkedAlerts = alerts.filter(a => a.accountNumber === f.primaryAccountNumber);
                let isFlashing = false;
                
                const fOrders = waterOrders.filter(o => o.fieldId === f.id);
                const isRunning = fOrders.some(o => o.status === WaterOrderStatus.InProgress);

                if (f.primaryAccountNumber) {
                    const acc = accounts.find(a => a.accountNumber === f.primaryAccountNumber);
                    linkedAlerts.forEach(alert => {
                        let triggered = false;
                        if ((alert.alertType === AlertType.Allotment || alert.alertType === AlertType.Both) && acc) {
                            const accStats = calculateAccountStats(acc);
                            if (accStats.total > 0) {
                                const remainingPct = (accStats.remaining / accStats.total) * 100;
                                if (remainingPct <= alert.thresholdPercent) triggered = true;
                            }
                        }
                        if (alert.alertType === AlertType.Allocation || alert.alertType === AlertType.Both) {
                            const fStats = calculateFieldStats(f);
                            if (fStats.total > 0) {
                                const remainingPct = (fStats.remaining / fStats.total) * 100;
                                if (remainingPct <= alert.thresholdPercent) triggered = true;
                            }
                        }
                        if (triggered) isFlashing = true;
                    });
                }
                
                let flashingClass = "";
                if (isFlashing) {
                    flashingClass = isRunning ? "animate-flash-blue" : "animate-flash-red";
                }

                return (
                    <div 
                        key={f.id} 
                        onClick={() => handleEditField(f)} 
                        className={`bg-white p-6 rounded-3xl shadow-lg border cursor-pointer group relative transition-all hover:-translate-y-1 ${isEditingField && newFieldId === f.id ? 'border-orange-400 ring-2 ring-orange-200 shadow-orange-100' : 'border-gray-100'} ${flashingClass}`}
                    >
                        <button 
                            onClick={(e) => handleDeleteSingleField(e, f.id, f.name)}
                            className="absolute top-4 right-4 p-2 bg-red-50 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 z-10"
                            title="Delete Field Registry"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                        <div className="flex justify-between items-start mb-2 pr-8">
                            <p className={`font-black text-lg transition-colors ${isEditingField && newFieldId === f.id ? 'text-orange-600' : 'text-gray-900 group-hover:text-indigo-600'}`}>{f.name}</p>
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
                         {!isEditingField && (
                             <div className="absolute inset-0 bg-indigo-900/0 group-hover:bg-indigo-900/5 rounded-3xl transition-colors flex items-center justify-center pointer-events-none">
                                 <span className="opacity-0 group-hover:opacity-100 bg-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm text-indigo-600">Click to Edit</span>
                             </div>
                         )}
                    </div>
                )
            })}
        </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto relative">
      {/* Inject custom animation keyframes for flashing fields safely */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flashRedWhite {
            0%, 100% { background-color: white; border-color: #f3f4f6; }
            50% { background-color: #fee2e2; border-color: #ef4444; }
        }
        @keyframes flashBlueWhite {
            0%, 100% { background-color: white; border-color: #f3f4f6; }
            50% { background-color: #dbeafe; border-color: #3b82f6; }
        }
        .animate-flash-red { animation: flashRedWhite 1.5s infinite; }
        .animate-flash-blue { animation: flashBlueWhite 1.5s infinite; }
      `}} />

      {/* Global Alert Notification Popup */}
      {unacknowledgedAlerts.length > 0 && (
          <div className="fixed inset-0 bg-red-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl overflow-hidden border-4 border-red-500 animate-in zoom-in-95 duration-200">
                  <div className="bg-red-600 p-8 text-white text-center">
                      <h2 className="text-3xl font-black uppercase tracking-tighter flex items-center justify-center gap-3">
                          <span className="text-4xl animate-bounce">⚠️</span> THRESHOLD ALERT
                      </h2>
                      <p className="text-red-100 font-bold text-sm mt-2">Immediate Review Required</p>
                  </div>
                  <div className="p-8 space-y-4 max-h-[50vh] overflow-y-auto">
                      {unacknowledgedAlerts.map(alert => (
                          <div key={alert.id} className="bg-red-50 p-6 rounded-3xl border border-red-100">
                              <h3 className="text-lg font-black text-red-900 mb-1">Account: {alert.accountNumber}</h3>
                              <p className="text-sm font-bold text-red-700 uppercase tracking-widest">
                                  {alert.alertType === AlertType.Allocation ? 'Allowance' : alert.alertType} dropped to {alert.thresholdPercent}% or below
                              </p>
                              <button 
                                  onClick={() => handleAcknowledgeAlert(alert.id)}
                                  className="mt-4 w-full bg-red-600 text-white py-3 rounded-xl font-black uppercase text-xs hover:bg-red-700 transition-colors"
                              >
                                  Acknowledge Alert
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

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
                                
                                // Calculate Flashing for standard table view
                                const linkedAlerts = alerts.filter(a => a.accountNumber === field.primaryAccountNumber);
                                let isFlashing = false;
                                const isRunning = waterOrders.some(o => o.fieldId === field.id && o.status === WaterOrderStatus.InProgress);
                                if (field.primaryAccountNumber) {
                                    const acc = accounts.find(a => a.accountNumber === field.primaryAccountNumber);
                                    linkedAlerts.forEach(alert => {
                                        let triggered = false;
                                        if ((alert.alertType === AlertType.Allotment || alert.alertType === AlertType.Both) && acc) {
                                            const accStats = calculateAccountStats(acc);
                                            if (accStats.total > 0) {
                                                const remainingPct = (accStats.remaining / accStats.total) * 100;
                                                if (remainingPct <= alert.thresholdPercent) triggered = true;
                                            }
                                        }
                                        if (alert.alertType === AlertType.Allocation || alert.alertType === AlertType.Both) {
                                            if (stats.total > 0) {
                                                const remainingPct = (stats.remaining / stats.total) * 100;
                                                if (remainingPct <= alert.thresholdPercent) triggered = true;
                                            }
                                        }
                                        if (triggered) isFlashing = true;
                                    });
                                }
                                let flashingClass = isFlashing ? (isRunning ? "animate-flash-blue" : "animate-flash-red") : "";

                                return (
                                <tr key={field.id} className={`hover:bg-gray-50 cursor-pointer transition-colors ${flashingClass}`} onClick={() => setSelectedFieldDetails(field)}>
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