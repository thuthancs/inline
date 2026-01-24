import { useCallback, useEffect, useState } from "react";
import { DEST_KEY, type Destination } from "../../types";

async function storageGet<T>(key: string): Promise<T | null> {
    const obj = await chrome.storage.local.get(key);
    return (obj[key] as T) ?? null;
}

async function storageSet<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
}

async function storageRemove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
}

async function getCurrentTabUrl(): Promise<string | null> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.url || null;
    } catch {
        return null;
    }
}

export function useDestination() {
    const [destination, setDestination] = useState<Destination | null>(null);

    // Load destination and check if URL matches (only on initial load/reload)
    useEffect(() => {
        (async () => {
            const currentUrl = await getCurrentTabUrl();
            const stored = await storageGet<Destination>(DEST_KEY);

            // Clear destination if URL doesn't match (page was reloaded on different URL)
            if (stored && stored.sourceUrl !== currentUrl) {
                await storageRemove(DEST_KEY);
                setDestination(null);
            } else {
                setDestination(stored);
            }
        })();
    }, []);

    const save = useCallback(async (d: Destination) => {
        // Add source URL to destination
        const currentUrl = await getCurrentTabUrl();
        const destWithUrl = { ...d, sourceUrl: currentUrl || undefined };
        await storageSet(DEST_KEY, destWithUrl);
        setDestination(destWithUrl);
    }, []);

    const clear = useCallback(async () => {
        await storageRemove(DEST_KEY);
        setDestination(null);
    }, []);

    return { destination, save, clear };
}
