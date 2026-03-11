/**
 * lib/auth.ts
 * 
 * Central auth helper for the dashboard.
 * Retrieves the current Supabase session token dynamically so we never
 * need to hardcode any JWT or anon key in component code.
 */

import { supabase } from './supabase';

/**
 * Returns the JWT access token for the current session, or null if unauthenticated.
 * Use this everywhere you need to make authenticated API calls.
 * 
 * @example
 *   const token = await getAuthToken();
 *   fetch('/api/user/stats', { headers: { Authorization: `Bearer ${token}` } })
 */
export async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
}

/**
 * Returns the current user's ID from the active session.
 */
export async function getCurrentUserId(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
}
