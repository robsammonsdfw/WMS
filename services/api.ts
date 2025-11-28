
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
  let url = '';
  
  if (typeof window !== 'undefined' && window.APP_CONFIG?.API_BASE_URL) {
    url = window.APP_CONFIG.API_BASE_URL;
  } else {
    // @ts-ignore
    url = (import.meta as any).env.VITE_API_BASE_URL || 'https://e6msras3ml.execute-api.us-east-1.amazonaws.com/v1';
  }

  // Safety check: Ensure the /v1 stage is present for this specific API Gateway.
  // This prevents CORS/403 errors if the environment variable is set without the stage.
  if (url.includes('execute-api.us-east-1.amazonaws.com')) {
      // Remove trailing slash if present
      if (url.endsWith('/')) {
          url = url.slice(0, -1);
      }
      // Append /v1 if missing
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
    // Ensure no double slashes if baseUrl has one and endpoint has one
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${cleanBase}${cleanEndpoint}`;

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
            if (response.status === 403 && (errorData.message === "Missing Authentication Token" || errorData.message === "Forbidden")) {
                 console.error(`[API Error] Access Denied for URL: ${url}`);
                 const method = (options.method || 'GET').toUpperCase();
                 
                 // If trying to POST, it's almost certainly a missing method in Gateway
                 if (method === 'POST') {
                     throw new Error(`AWS Configuration Error: The 'POST' method is missing for ${cleanEndpoint} in API Gateway. \n\nTo fix this: Go to AWS Console > API Gateway > Resources > ${cleanEndpoint} > Actions > Create Method > POST. Then click Actions > Deploy API.`);
                 }

                 throw new Error(`Access Denied: API Gateway rejected the request. Check that your URL ends in '/v1' and the route exists in the 'v1' stage.`);
            }

            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    } catch (error: any) {
        console.error(`API call to ${url} failed:`, error);
        
        // Check for specific CORS/Network failure
        if (error instanceof TypeError && error.message === "Failed to fetch") {
            // This is often caused by a 403 from Gateway (due to missing /v1) which doesn't return CORS headers,
            // resulting in a generic "Failed to fetch" in the browser.
            throw new Error(`Connection failed (CORS). This usually means the API URL is incorrect (missing '/v1') or the backend is offline. Trying to access: ${url}`);
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
