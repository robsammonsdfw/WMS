import { WaterOrder, Field } from '../types';

// The base URL for your API Gateway endpoint.
// This should be set in your Amplify environment variables.
// Fix: The triple-slash directive for vite/client was causing a resolution error. Removing it and casting `import.meta` to `any` to access environment variables is a pragmatic workaround when the build environment is misconfigured.
const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL;

// A helper function to handle fetch requests and errors
const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Set default headers
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    try {
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred' }));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    } catch (error) {
        console.error(`API call to ${endpoint} failed:`, error);
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