import type { SearchItem } from "./types";

// Production URL - update this after Vercel deployment
export const API_BASE = "https://inline-notion.vercel.app";

// Session storage key
const SESSION_KEY = "inline_session_id";

// Timeout for API calls (10 seconds)
const API_TIMEOUT = 10000;

/**
 * Get session ID from chrome storage
 */
export async function getSessionId(): Promise<string | null> {
    try {
        const result = await chrome.storage.local.get(SESSION_KEY);
        const sessionId = result[SESSION_KEY];
        return typeof sessionId === "string" ? sessionId : null;
    } catch {
        return null;
    }
}

/**
 * Save session ID to chrome storage
 */
export async function setSessionId(sessionId: string): Promise<void> {
    await chrome.storage.local.set({ [SESSION_KEY]: sessionId });
}

/**
 * Clear session ID from chrome storage
 */
export async function clearSessionId(): Promise<void> {
    await chrome.storage.local.remove(SESSION_KEY);
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out. Is the server running?');
        }
        throw error;
    }
}

/**
 * Fetch with session authentication
 */
async function fetchWithAuth(url: string, options: RequestInit): Promise<Response> {
    const sessionId = await getSessionId();
    
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (sessionId) {
        headers.set("x-session-id", sessionId);
    }
    
    return fetchWithTimeout(url, { ...options, headers });
}

async function readError(res: Response): Promise<string> {
    try {
        const j = await res.json();
        if (j?.error) return String(j.error);
    } catch {
        // JSON parse failed, use status text
    }
    return `${res.status} ${res.statusText}`;
}

// ============ Auth API ============

/**
 * Check if user is authenticated
 */
export async function checkAuthStatus(): Promise<{ connected: boolean; workspaceName?: string; workspaceIcon?: string }> {
    try {
        const sessionId = await getSessionId();
        if (!sessionId) return { connected: false };
        
        const res = await fetchWithAuth(`${API_BASE}/auth/session`, {
            method: "GET",
        });
        
        if (!res.ok) {
            // Session invalid, clear it
            await clearSessionId();
            return { connected: false };
        }
        
        return await res.json();
    } catch {
        return { connected: false };
    }
}

/**
 * Logout - delete session
 */
export async function logout(): Promise<void> {
    try {
        await fetchWithAuth(`${API_BASE}/auth/logout`, { method: "POST" });
    } catch {
        // Ignore errors during logout
    }
    await clearSessionId();
}

/**
 * Get the OAuth URL to start authentication
 */
export function getOAuthUrl(): string {
    return `${API_BASE}/auth/notion`;
}

// ============ Notion API ============

export async function apiSearch(query: string): Promise<SearchItem[]> {
    const res = await fetchWithAuth(`${API_BASE}/search`, {
        method: "POST",
        body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function apiCreatePage(
    parent_id: string,
    title: string,
    parent_type: string = "page",
    properties?: any
): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/create-page`, {
        method: "POST",
        body: JSON.stringify({ parent_id, title, parent_type, properties }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
}

export async function apiSave(page_id: string, content: string, images?: string[]): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/save`, {
        method: "PATCH",
        body: JSON.stringify({ page_id, content, images }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
}

export async function apiComment(block_id: string, comment_text: string): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/comment`, {
        method: "POST",
        body: JSON.stringify({ block_id, comment_text }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
}

// Combined save + comment in one request (faster)
export async function apiSaveWithComment(page_id: string, content: string, comment_text: string): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/save-with-comment`, {
        method: "POST",
        body: JSON.stringify({ page_id, content, comment_text }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
}

export async function apiGetChildren(pageId: string): Promise<SearchItem[]> {
    const res = await fetchWithAuth(`${API_BASE}/children/${pageId}`, {
        method: "GET",
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function apiGetDataSources(databaseId: string): Promise<SearchItem[]> {
    const res = await fetchWithAuth(`${API_BASE}/data-sources/${databaseId}`, {
        method: "GET",
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function apiGetDataSource(dataSourceId: string): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE}/data-source/${dataSourceId}`, {
        method: "GET",
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
}
