import { useEffect, useState } from "react";
import { 
    API_BASE,
    checkAuthStatus, 
    logout as apiLogout, 
    setSessionId,
} from "../../api";

export interface AuthState {
    isConnected: boolean;
    workspaceName: string | null;
    workspaceIcon: string | null;
    loading: boolean;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        isConnected: false,
        workspaceName: null,
        workspaceIcon: null,
        loading: true,
    });

    useEffect(() => {
        checkAuth();
    }, []);

    async function checkAuth() {
        setState(prev => ({ ...prev, loading: true }));
        try {
            const status = await checkAuthStatus();
            setState({
                isConnected: status.connected,
                workspaceName: status.workspaceName || null,
                workspaceIcon: status.workspaceIcon || null,
                loading: false,
            });
        } catch {
            setState({
                isConnected: false,
                workspaceName: null,
                workspaceIcon: null,
                loading: false,
            });
        }
    }

    async function connectNotion() {
        try {
            // Use Chrome's identity API for OAuth flow
            const authUrl = `${API_BASE}/auth/notion`;
            
            const redirectUrl = await chrome.identity.launchWebAuthFlow({
                url: authUrl,
                interactive: true,
            });
            
            if (!redirectUrl) {
                throw new Error("OAuth flow was cancelled");
            }
            
            // Extract session ID from redirect URL
            const url = new URL(redirectUrl);
            const sessionId = url.searchParams.get("session");
            
            if (sessionId) {
                await setSessionId(sessionId);
                await checkAuth();
            } else {
                throw new Error("No session ID returned from OAuth");
            }
        } catch (error: any) {
            console.error("OAuth failed:", error);
            throw error;
        }
    }

    async function disconnect() {
        setState(prev => ({ ...prev, loading: true }));
        try {
            await apiLogout();
        } finally {
            setState({
                isConnected: false,
                workspaceName: null,
                workspaceIcon: null,
                loading: false,
            });
        }
    }

    return {
        ...state,
        connectNotion,
        disconnect,
        checkAuth,
    };
}

