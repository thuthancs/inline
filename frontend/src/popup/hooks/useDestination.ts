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

export function useDestination() {
    const [destination, setDestination] = useState<Destination | null>(null);

    useEffect(() => {
        storageGet<Destination>(DEST_KEY).then(setDestination);
    }, []);

    const save = useCallback(async (d: Destination) => {
        await storageSet(DEST_KEY, d);
        setDestination(d);
    }, []);

    const clear = useCallback(async () => {
        await storageRemove(DEST_KEY);
        setDestination(null);
    }, []);

    return { destination, save, clear };
}

