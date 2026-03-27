import { WaterOrder, Field, WaterBankEntry, Lateral, Headgate, WaterAccount, AccountAlert, User } from '../types';

const getBaseUrl = () => {
  let url = (window as any).APP_CONFIG?.API_BASE_URL || 'https://e6msras3ml.execute-api.us-east-1.amazonaws.com/v1';
  if (url.endsWith('/')) url = url.slice(0, -1);
  return url;
};

const getApiKey = () => (window as any).APP_CONFIG?.API_KEY || '';

// Retrieve the token from local storage
const getToken = () => localStorage.getItem('wms_token') || '';

const NUMERIC_FIELDS = [
  'acres', 'totalWaterAllocation', 'waterUsed', 'waterAllotment', 
  'allotmentUsed', 'lat', 'lng', 'requestedAmount', 'requestedInches',
  'amountAvailable', 'allocationForField', 'usageForField', 'currentRunningInches',
  'totalAllotment', 'thresholdPercent'
];

const normalizeData = (data: any): any => {
    if (Array.isArray(data)) return data.map(normalizeData);
    if (data !== null && typeof data === 'object') {
        return Object.keys(data).reduce((acc, key) => {
            const camelKey = key.replace(/(_\w)/g, (m) => m[1].toUpperCase());
            let value = data[key];
            
            if (NUMERIC_FIELDS.includes(camelKey) && typeof value === 'string') {
              const num = parseFloat(value);
              value = isNaN(num) ? 0 : num;
            }

            // @ts-ignore
            acc[camelKey] = normalizeData(value);
            return acc;
        }, {});
    }
    return data;
};

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const baseUrl = getBaseUrl();
    const apiKey = getApiKey();
    const token = getToken();
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string> || {},
    };
    
    if (apiKey) headers['x-api-key'] = apiKey;
    
    // Attach the Authorization token to every request
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
        const response = await fetch(url, { ...options, headers });
        const text = await response.text();
        
        if (!response.ok) {
            // Auto-logout if the token expires
            if (response.status === 401) {
                localStorage.removeItem('wms_token');
                localStorage.removeItem('wms_user');
                window.location.reload();
            }
            
            let errorMsg = `Error ${response.status}`;
            try {
                const json = JSON.parse(text);
                errorMsg = json.details || json.message || json.error || errorMsg;
            } catch (e) { errorMsg = text || errorMsg; }
            throw new Error(errorMsg);
        }

        const json = JSON.parse(text);
        return normalizeData(json);
    } catch (error: any) {
        console.error(`[API ERROR] ${endpoint}:`, error.message);
        throw error;
    }
};

// --- AUTHENTICATION & USERS ---
export const login = (data: any): Promise<any> => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const signup = (data: any): Promise<any> => apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(data) });
export const getUsers = (): Promise<User[]> => apiFetch('/users');
export const createUser = (data: Partial<User>): Promise<User> => apiFetch('/users', { method: 'POST', body: JSON.stringify(data) });
export const updateUser = (id: string | number, data: Partial<User>): Promise<any> => apiFetch(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteUser = (id: string | number): Promise<any> => apiFetch(`/users/${id}`, { method: 'DELETE' });

// --- CORE DATA ---
export const getWaterOrders = (): Promise<WaterOrder[]> => apiFetch('/orders');
export const createWaterOrder = (data: Partial<WaterOrder>): Promise<WaterOrder> => apiFetch('/orders', { method: 'POST', body: JSON.stringify(data) });
export const updateWaterOrder = (id: string, data: Partial<WaterOrder>): Promise<any> => apiFetch(`/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const getFields = (): Promise<Field[]> => apiFetch('/fields');
export const createField = (data: Partial<Field>): Promise<any> => apiFetch('/fields', { method: 'POST', body: JSON.stringify(data) });
export const deleteField = (id: string): Promise<any> => apiFetch(`/fields/${id}`, { method: 'DELETE' });
export const getLaterals = (): Promise<Lateral[]> => apiFetch('/laterals').catch(() => []);
export const getHeadgates = (): Promise<Headgate[]> => apiFetch('/headgates').catch(() => []);
export const createLateral = (data: Partial<Lateral>): Promise<any> => apiFetch('/laterals', { method: 'POST', body: JSON.stringify(data) });
export const createHeadgate = (data: Partial<Headgate>): Promise<any> => apiFetch('/headgates', { method: 'POST', body: JSON.stringify(data) });
export const setFieldAccountQueue = (fieldId: string, accountId: number): Promise<any> => apiFetch(`/fields/${fieldId}/queue`, { method: 'PUT', body: JSON.stringify({ accountId }) });
export const getWaterBank = (): Promise<WaterBankEntry[]> => apiFetch('/water-bank');
export const getWaterAccounts = (): Promise<WaterAccount[]> => apiFetch('/accounts').catch(() => []);
export const createWaterAccount = (data: Partial<WaterAccount>): Promise<any> => apiFetch('/accounts', { method: 'POST', body: JSON.stringify(data) });
export const deleteWaterAccount = (id: string): Promise<any> => apiFetch(`/accounts/${id}`, { method: 'DELETE' });
export const resetDatabase = (): Promise<any> => apiFetch('/admin/reset-db', { method: 'POST' });

// --- ALERTS ---
export const getAlerts = (): Promise<AccountAlert[]> => apiFetch('/alerts').catch(() => []);
export const createAlerts = (data: Partial<AccountAlert>[]): Promise<any> => apiFetch('/alerts', { method: 'POST', body: JSON.stringify(data) });
export const updateAlert = (id: string, data: Partial<AccountAlert>): Promise<any> => apiFetch(`/alerts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteAlert = (id: string): Promise<any> => apiFetch(`/alerts/${id}`, { method: 'DELETE' });