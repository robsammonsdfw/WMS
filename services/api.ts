
import { WaterOrder, Field, WaterBankEntry } from '../types';

// Declare global to access window.APP_CONFIG
declare global {
  interface Window {
    APP_CONFIG?: {
      API_KEY?: string;
      API_BASE_URL?: string;
    };
  }
}

// Helper to get configuration with fallbacks
const getBaseUrl = () => {
  let url = '';
  
  if (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE_URL) {
    url = window.APP_CONFIG.API_BASE_URL;
  } else {
    // @ts-ignore
    url = (import.meta as any).env.VITE_API_BASE_URL || 'https://e6msras3ml.execute-api.us-east-1.amazonaws.com/v1';
  }

  if (url.includes('execute-api.us-east-1.amazonaws.com')) {
      if (url.endsWith('/')) {
          url = url.slice(0, -1);
      }
      if (!url.endsWith('/v1')) {
          url = `${url}/v1`;
      }
  }

  return url;
};

const getApiKey = () => {
  if (typeof window !== 'undefined' && window.APP_CONFIG?.API_KEY) {
    return window.APP_CONFIG.API_KEY;
  }
  // @ts-ignore
  return (import.meta as any).env.VITE_API_KEY;
};

// A helper function to handle fetch requests and errors
const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const baseUrl = getBaseUrl();
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${cleanBase}${cleanEndpoint}`;

    console.log(`[API Request] ${options.method || 'GET'} ${url}`);

    const apiKey = getApiKey();
    
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
    };

    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    try {
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
            
            if (response.status === 403 && (errorData.message === "Missing Authentication Token" || errorData.message === "Forbidden")) {
                 console.error(`[API Error] Access Denied for URL: ${url}`);
                 const method = (options.method || 'GET').toUpperCase();
                 if (method === 'POST') {
                     throw new Error(`AWS Configuration Error: POST method missing.`);
                 }
                 throw new Error(`Access Denied: API Gateway rejected the request.`);
            }

            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    } catch (error: any) {
        console.error(`API call to ${url} failed:`, error);
        if (error instanceof TypeError && error.message === "Failed to fetch") {
            throw new Error(`Connection failed (CORS).`);
        }
        throw error;
    }
};

// --- API Functions for Water Orders ---

export const getWaterOrders = (): Promise<WaterOrder[]> => {
    return apiFetch('/orders');
};

export const createWaterOrder = (orderData: Partial<WaterOrder>): Promise<WaterOrder> => {
    return apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify(orderData),
    });
};

export const updateWaterOrder = (orderId: string, orderData: Partial<WaterOrder>): Promise<WaterOrder> => {
    return apiFetch(`/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify(orderData),
    });
};

// --- API Functions for Fields ---

export const getFields = (): Promise<Field[]> => {
    return apiFetch('/fields');
};

export const setFieldAccountQueue = (fieldId: string, nextAccountId: number): Promise<any> => {
    return apiFetch(`/fields/${fieldId}/accounts`, {
        method: 'PUT',
        body: JSON.stringify({ nextAccountId }),
    });
};

// --- API Functions for Water Bank ---

export const getWaterBank = (): Promise<WaterBankEntry[]> => {
    return apiFetch('/water-bank').catch(() => []);
};

// --- Admin ---
export const resetDatabase = (): Promise<any> => {
    return apiFetch('/admin/reset-db', { method: 'POST' });
};
