import type { SearchItem } from "./types";

export const API_BASE = "http://localhost:64707";

async function readError(res: Response): Promise<string> {
    try {
        const j = await res.json();
        if (j?.error) return String(j.error);
    } catch { }
    return `${res.status} ${res.statusText}`;
}

export async function apiSearch(query: string): Promise<SearchItem[]> {
    const res = await fetch(`${API_BASE}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    const res = await fetch(`${API_BASE}/create-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id, title, parent_type, properties }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json(); // Notion page object (contains id, url, etc.)
}

export async function apiSave(page_id: string, content: string): Promise<any> {
    const res = await fetch(`${API_BASE}/save`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_id, content }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json(); // append response, includes results (blocks)
}

export async function apiComment(block_id: string, comment_text: string): Promise<any> {
    const res = await fetch(`${API_BASE}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block_id, comment_text }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
}

export async function apiGetChildren(pageId: string): Promise<SearchItem[]> {
    const res = await fetch(`${API_BASE}/children/${pageId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function apiGetDataSources(databaseId: string): Promise<SearchItem[]> {
    const res = await fetch(`${API_BASE}/data-sources/${databaseId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

export async function apiGetDataSource(dataSourceId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/data-source/${dataSourceId}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(await readError(res));
    return await res.json();
}
