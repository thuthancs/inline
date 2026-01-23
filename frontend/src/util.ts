export async function getActiveTabInfo(): Promise<{ url?: string; title?: string }> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return { url: tab?.url, title: tab?.title };
    } catch {
        return {};
    }
}