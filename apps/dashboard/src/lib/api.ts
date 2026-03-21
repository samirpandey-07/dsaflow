import { getAuthToken } from './auth';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api`;

export async function apiFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
    const token = await getAuthToken();
    const headers = new Headers(init?.headers || {});

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    if (init?.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...init,
        headers,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload?.message || `Request failed for ${endpoint}`);
    }

    return payload?.data ?? payload;
}

export { API_BASE };
