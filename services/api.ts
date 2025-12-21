
import { WaterOrder, Field, WaterBankEntry, Lateral, Headgate } from '../types';

declare global {
  interface Window {
    APP_CONFIG?: {
      API_KEY?: string;
      API_BASE_URL?: string;
    };
  }
}

const getBaseUrl = () => {
  let url = '';
  if (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE_URL) {
    url = window.APP_CONFIG.API_BASE_URL;
  } else {
    // @ts-ignore
    url = (import.meta as any).env.VITE_API_BASE_URL || 'https://e6msras3ml.execute-api.us-east-1.amazonaws.com/v1';
  }
  if (url.includes('execute-api.us-east-1.amazonaws.com')) {
      if (url.endsWith('/')) url = url.slice(0, -1);
      if (!url.endsWith('/v1')) url = `${url}/v1`;
  }
  return url;
};

const getApiKey = () => {
  if (typeof window !== 'undefined' && window.APP_CONFIG?.API_KEY) return window.APP_CONFIG.API_KEY;
  // @ts-ignore
  return (import.meta as any).env.VITE_API_KEY;
};

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const baseUrl = getBaseUrl();
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${cleanBase}${cleanEndpoint}`;
    const apiKey = getApiKey();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
    };
    if (apiKey) headers['x-api-key'] = apiKey;

    try {
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    } catch (error: any) {
        console.error(`API call to ${url} failed:`, error);
        throw error;
    }
};

export const getWaterOrders = (): Promise<WaterOrder[]> => apiFetch('/orders');
export const createWaterOrder = (orderData: Partial<WaterOrder>): Promise<WaterOrder> => apiFetch('/orders', { method: 'POST', body: JSON.stringify(orderData) });
export const updateWaterOrder = (orderId: string, orderData: Partial<WaterOrder>): Promise<WaterOrder> => apiFetch(`/orders/${orderId}`, { method: 'PUT', body: JSON.stringify(orderData) });

export const getFields = (): Promise<Field[]> => apiFetch('/fields');
export const getLaterals = (): Promise<Lateral[]> => apiFetch('/laterals');
export const createLateral = (data: Partial<Lateral>): Promise<Lateral> => apiFetch('/laterals', { method: 'POST', body: JSON.stringify(data) });
export const getHeadgates = (): Promise<Headgate[]> => apiFetch('/headgates');
export const createHeadgate = (data: Partial<Headgate>): Promise<Headgate> => apiFetch('/headgates', { method: 'POST', body: JSON.stringify(data) });

export const setFieldAccountQueue = (fieldId: string, nextAccountId: number): Promise<any> => apiFetch(`/fields/${fieldId}/accounts`, { method: 'PUT', body: JSON.stringify({ nextAccountId }) });
export const getWaterBank = (): Promise<WaterBankEntry[]> => apiFetch('/water-bank').catch(() => []);
export const resetDatabase = (): Promise<any> => apiFetch('/admin/reset-db', { method: 'POST' });
