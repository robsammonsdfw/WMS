
import { WaterOrder, Field } from '../types';

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
  if (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE_URL) {
    return window.APP_CONFIG.API_BASE_URL;
  }
  // @ts-ignore
  // Updated to us-east-1 API ID from user screenshot (e6msras3ml)
  return (import.meta as any).env.VITE_API_BASE_URL || 'https://e6msras3ml.execute-api.us-east-1.amazonaws.com/v1';
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
    const url = `${getBaseUrl()}${endpoint}`;
    const apiKey = getApiKey();
    
    // Set default headers
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>,
    };

    // Add API Key if available (Optional for HTTP APIs usually)
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    try {
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
            
            // Provide a more helpful error for the specific Gateway 403
            if (response.status === 403 && errorData.message === "Missing Authentication Token") {
                 throw new Error("Access Denied: The API Gateway rejected the request. Ensure you have deployed the routes (GET/POST /orders) in the API Gateway Console.");
            }

            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    } catch (error: any) {
        console.error(`API call to ${endpoint} failed:`, error);
        
        // Check for specific CORS/Network failure
        if (error instanceof TypeError && error.message === "Failed to fetch") {
            throw new Error("Connection failed. This is likely a CORS issue. Please go to AWS API Gateway > CORS and enable it for your API.");
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
