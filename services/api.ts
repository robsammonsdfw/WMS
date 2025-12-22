
import { WaterOrder, Field, WaterBankEntry, Lateral, Headgate } from '../types';

const getBaseUrl = () => {
  let url = '';
  
  // Check window config (Amplify injection) or Vite env
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG?.API_BASE_URL) {
    url = (window as any).APP_CONFIG.API_BASE_URL;
  } else {
    // @ts-ignore - Default to your working endpoint
    url = (import.meta as any).env.VITE_API_BASE_URL || 'https://e6msras3ml.execute-api.us-east-1.amazonaws.com/v1';
  }
  
  // Normalize: Remove trailing slash
  if (url.endsWith('/')) url = url.slice(0, -1);
  
  // AUTO-FIX: AWS Gateway usually needs the stage name (like /v1)
  // If the user's base URL doesn't have it, we append it to prevent 'Missing Authentication Token'
  if (url.includes('execute-api') && !url.endsWith('/v1')) {
      url = `${url}/v1`;
  }
  
  return url;
};

const getApiKey = () => {
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG?.API_KEY) return (window as any).APP_CONFIG.API_KEY;
  // @ts-ignore
  return (import.meta as any).env.VITE_API_KEY || '';
};

const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const baseUrl = getBaseUrl();
    const apiKey = getApiKey();
    
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string> || {},
    };
    
    // Only send the key if it exists. For public demo APIs, we don't want to force it.
    if (apiKey) {
        headers['x-api-key'] = apiKey;
    }

    try {
        const response = await fetch(url, { ...options, headers });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // Provide a friendly error for the demo
            throw new Error(errorData.message || "The server is currently processing requests. Please try again in a moment.");
        }
        return response.json();
    } catch (error: any) {
        console.error(`[API Error]`, error);
        // During a demo, we want to keep the UX clean
        if (error.message.includes('Missing Authentication Token')) {
            throw new Error("Connection Refused: Please ensure the API endpoint URL is correct in your settings.");
        }
        throw error;
    }
};

export const getWaterOrders = (): Promise<WaterOrder[]> => apiFetch('/orders');
export const createWaterOrder = (orderData: Partial<WaterOrder>): Promise<WaterOrder> => apiFetch('/orders', { method: 'POST', body: JSON.stringify(orderData) });
export const updateWaterOrder = (orderId: string, orderData: Partial<WaterOrder>): Promise<WaterOrder> => apiFetch(`/orders/${orderId}`, { method: 'PUT', body: JSON.stringify(orderData) });

export const getFields = (): Promise<Field[]> => apiFetch('/fields');
export const createField = (data: Partial<Field> & { headgateIds?: string[] }): Promise<Field> => apiFetch('/fields', { method: 'POST', body: JSON.stringify(data) });

export const getLaterals = (): Promise<Lateral[]> => apiFetch('/laterals');
export const createLateral = (data: Partial<Lateral>): Promise<Lateral> => apiFetch('/laterals', { method: 'POST', body: JSON.stringify(data) });

export const getHeadgates = (): Promise<Headgate[]> => apiFetch('/headgates');
export const createHeadgate = (data: Partial<Headgate>): Promise<Headgate> => apiFetch('/headgates', { method: 'POST', body: JSON.stringify(data) });

export const setFieldAccountQueue = (fieldId: string, nextAccountId: number): Promise<any> => apiFetch(`/fields/${fieldId}/accounts`, { method: 'PUT', body: JSON.stringify({ nextAccountId }) });
export const getWaterBank = (): Promise<WaterBankEntry[]> => apiFetch('/water-bank').catch(() => []);
export const resetDatabase = (): Promise<any> => apiFetch('/admin/reset-db', { method: 'POST' });
