import axios from 'axios';
import { getCsrfToken } from '../utils';

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = getCsrfToken();
    if (token) {
        config.headers['X-CSRF-TOKEN'] = token;
    }
    return config;
});

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
}

export async function fetchPaginated<T>(url: string, params?: Record<string, string | number | undefined>): Promise<PaginatedResponse<T>> {
    const { data } = await api.get<PaginatedResponse<T>>(url, { params });
    return data;
}

export async function createItem<T>(url: string, payload: object): Promise<T> {
    const { data } = await api.post<T>(url, payload);
    return data;
}

export async function updateItem<T>(url: string, payload: object): Promise<T> {
    const { data } = await api.put<T>(url, payload);
    return data;
}

export async function deleteItem(url: string): Promise<void> {
    await api.delete(url);
}
