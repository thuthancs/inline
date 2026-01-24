import { useCallback, useMemo, useState } from "react";
import { apiGetChildren, apiGetDataSources, apiSearch } from "../../api";
import type { SearchItem } from "../../types";

export function useSearch() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchItem[]>([]);
    const [selected, setSelected] = useState<SearchItem | null>(null);
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState("");

    // Children state
    const [children, setChildren] = useState<SearchItem[]>([]);
    const [loadingChildrenFor, setLoadingChildrenFor] = useState<string | null>(null);

    // Data sources state
    const [dataSources, setDataSources] = useState<SearchItem[]>([]);
    const [loadingDataSourcesFor, setLoadingDataSourcesFor] = useState<string | null>(null);

    const pageResults = useMemo(
        () => results.filter((r) => r.type === "page" || r.type === "database" || r.type === "data_source"),
        [results]
    );

    const search = useCallback(async () => {
        const q = query.trim();
        if (!q) return;

        setStatus("");
        setBusy(true);
        setSelected(null);
        setChildren([]);
        setDataSources([]);

        try {
            const data = await apiSearch(q);
            setResults(data);
            if (data.length === 0) setStatus("No results.");
        } catch (e: any) {
            setStatus(`Search failed: ${e?.message || "unknown"}`);
        } finally {
            setBusy(false);
        }
    }, [query]);

    const loadChildren = useCallback(async (pageId: string) => {
        setLoadingChildrenFor(pageId);
        setStatus("Loading children...");
        setDataSources([]);

        try {
            const data = await apiGetChildren(pageId);
            setChildren(data);
            if (data.length === 0) {
                setStatus("No child databases found in this page.");
            } else {
                setStatus(`Found ${data.length} child database(s).`);
            }
        } catch (e: any) {
            setStatus(`Load children failed: ${e?.message || "unknown"}`);
            setChildren([]);
        } finally {
            setLoadingChildrenFor(null);
        }
    }, []);

    const loadDataSources = useCallback(async (databaseId: string) => {
        setLoadingDataSourcesFor(databaseId);
        setStatus("Loading data sources...");

        try {
            const data = await apiGetDataSources(databaseId);
            setDataSources(data);
            if (data.length === 0) {
                setStatus("No data sources found in this database.");
            } else {
                setStatus(`Found ${data.length} data source(s).`);
            }
        } catch (e: any) {
            setStatus(`Load data sources failed: ${e?.message || "unknown"}`);
            setDataSources([]);
        } finally {
            setLoadingDataSourcesFor(null);
        }
    }, []);

    const clearResults = useCallback(() => {
        setResults([]);
        setSelected(null);
        setChildren([]);
        setDataSources([]);
        setQuery("");
    }, []);

    return {
        // State
        query,
        setQuery,
        results: pageResults,
        selected,
        setSelected,
        busy,
        setBusy,
        status,
        setStatus,
        children,
        loadingChildrenFor,
        dataSources,
        loadingDataSourcesFor,

        // Actions
        search,
        loadChildren,
        loadDataSources,
        clearResults,
    };
}

