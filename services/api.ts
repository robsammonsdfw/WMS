
import { WaterOrder, Field, WaterBankEntry, Lateral, Headgate } from '../types';

const getBaseUrl = () => {
  let url = '';
  
  if (typeof window !== 'undefined' && (window as any).APP_CONFIG?.API_BASE_URL) {
    url = (window as any).APP_CONFIG.API_BASE_URL;
  } else {
    // @ts-ignore
    url = (import.meta as any).env.VITE_API_BASE_URL || 'https://e6msras3ml.execute-api.us-east-1.amazonaws.com/v1';
  }
  
  if (url.endsWith('/')) url = url.slice(0, -1);
  
  const isAwsGateway = url.includes('execute-api');
  const hasStage = /\/(v1|prod|dev|v2)$/.test(url);
  
  if (isAwsGateway && !hasStage) {
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
    const method = options.method || 'GET';
    
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;
    
    console.log(`[AquaTrack API] ${method} -> ${url}`);

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string> || {},
    };
    
    if (apiKey) {
        headers['x-api-key'] = apiKey;
    }

    try {
        const response = await fetch(url, { ...options, headers });
        
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Server Error (${response.status})`;
            
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorMessage;
            } catch (e) {
                errorMessage = errorText || errorMessage;
            }

            // DIAGNOSTIC FIX: Specifically handle the error seen in the user's screenshot
            if (response.status === 403 && (errorMessage.includes('Missing Authentication Token') || errorMessage === 'Forbidden')) {
                throw new Error(`CONFIGURATION ERROR: The ${method} method for ${endpoint} is likely missing in your AWS API Gateway Console. Please add the ${method} method to the ${endpoint} resource and Deploy the API.`);
            }
            
            throw new Error(errorMessage);
        }
        return response.json();
    } catch (error: any) {
        console.error(`[AquaTrack API Failure]`, error);
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
