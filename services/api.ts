
import { WaterOrder, Field, WaterBankEntry, Lateral, Headgate } from '../types';

const getBaseUrl = () => {
  let url = (window as any).APP_CONFIG?.API_BASE_URL || 'https://e6msras3ml.execute-api.us-east-1.amazonaws.com/v1';
  if (url.endsWith('/')) url = url.slice(0, -1);
  return url;
};

const getApiKey = () => (window as any).APP_CONFIG?.API_KEY || '';

const normalizeData = (data: any): any => {
    if (Array.isArray(data)) return data.map(normalizeData);
    if (data !== null && typeof data === 'object') {
        return Object.keys(data).reduce((acc, key) => {
            const camelKey = key.replace(/(_\w)/g, (m) => m[1].toUpperCase());
            // @ts-ignore
            acc[camelKey] = normalizeData(data[key]);
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
export const getLaterals = (): Promise<Lateral[]> => apiFetch('/laterals').catch(() => []);
export const getHeadgates = (): Promise<Headgate[]> => apiFetch('/headgates').catch(() => []);
// Fix: Added missing export for createLateral
export const createLateral = (data: Partial<Lateral>): Promise<any> => apiFetch('/laterals', { method: 'POST', body: JSON.stringify(data) });
// Fix: Added missing export for createHeadgate
export const createHeadgate = (data: Partial<Headgate>): Promise<any> => apiFetch('/headgates', { method: 'POST', body: JSON.stringify(data) });
// Fix: Added missing export for setFieldAccountQueue
export const setFieldAccountQueue = (fieldId: string, accountId: number): Promise<any> => apiFetch(`/fields/${fieldId}/queue`, { method: 'PUT', body: JSON.stringify({ accountId }) });
// Fix: Added missing export for getWaterBank
export const getWaterBank = (): Promise<WaterBankEntry[]> => apiFetch('/water-bank');
export const resetDatabase = (): Promise<any> => apiFetch('/admin/reset-db', { method: 'POST' });
