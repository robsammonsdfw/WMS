
import { WaterOrder, Field, WaterBankEntry, Lateral, Headgate, WaterAccount } from '../types';

const getBaseUrl = () => {
  let url = (window as any).APP_CONFIG?.API_BASE_URL || 'ttps://ybbaesm77d2si3m2m4liavhu6i0txdkt.lambda-url.us-west-1.on.aws/v1';
  if (url.endsWith('/')) url = url.slice(0, -1);
  return url;
};

const getApiKey = () => (window as any).APP_CONFIG?.API_KEY || '';

// Fields that should always be converted to numbers
const NUMERIC_FIELDS = [
  'acres', 'totalWaterAllocation', 'waterUsed', 'waterAllotment', 
  'allotmentUsed', 'lat', 'lng', 'requestedAmount', 'requestedInches',
  'amountAvailable', 'allocationForField', 'usageForField', 'currentRunningInches',
  'totalAllotment'
];

const normalizeData = (data: any): any => {
    if (Array.isArray(data)) return data.map(normalizeData);
    if (data !== null && typeof data === 'object') {
        return Object.keys(data).reduce((acc, key) => {
            const camelKey = key.replace(/(_\w)/g, (m) => m[1].toUpperCase());
            let value = data[key];
            
            // Convert strings to numbers for known numeric fields
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
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string> || {},
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    try {
        const response = await fetch(url, { ...options, headers });
        const text = await response.text();
        
        if (!response.ok) {
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
export const resetDatabase = (): Promise<any> => apiFetch('/admin/reset-db', { method: 'POST' });
