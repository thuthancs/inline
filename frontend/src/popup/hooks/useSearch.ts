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
    const [childrenForPage, setChildrenForPage] = useState<string | null>(null);
    const [childrenExpanded, setChildrenExpanded] = useState(false);
    const [loadingChildrenFor, setLoadingChildrenFor] = useState<string | null>(null);

    // Data sources state
    const [dataSources, setDataSources] = useState<SearchItem[]>([]);
    const [dataSourcesForDatabase, setDataSourcesForDatabase] = useState<string | null>(null);
    const [dataSourcesExpanded, setDataSourcesExpanded] = useState(false);
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
        setChildrenForPage(null);
        setChildrenExpanded(false);
        setDataSources([]);
        setDataSourcesForDatabase(null);
        setDataSourcesExpanded(false);

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

    const toggleChildren = useCallback(async (pageId: string) => {
        // If already loaded for this page, just toggle visibility
        if (childrenForPage === pageId && children.length > 0) {
            setChildrenExpanded(prev => !prev);
            // When collapsing children, also collapse data sources
            if (childrenExpanded) {
                setDataSourcesExpanded(false);
            }
            return;
        }

        // Load children
        setLoadingChildrenFor(pageId);
        setStatus("Loading children...");
        setDataSources([]);
        setDataSourcesForDatabase(null);
        setDataSourcesExpanded(false);

        try {
            const data = await apiGetChildren(pageId);
            setChildren(data);
            setChildrenForPage(pageId);
            setChildrenExpanded(true);
            if (data.length === 0) {
                setStatus("No child databases found in this page.");
            } else {
                setStatus(`Found ${data.length} child database(s).`);
            }
        } catch (e: any) {
            setStatus(`Load children failed: ${e?.message || "unknown"}`);
            setChildren([]);
            setChildrenForPage(null);
            setChildrenExpanded(false);
        } finally {
            setLoadingChildrenFor(null);
        }
    }, [childrenForPage, children.length, childrenExpanded]);

    const toggleDataSources = useCallback(async (databaseId: string) => {
        // If already loaded for this database, just toggle visibility
        if (dataSourcesForDatabase === databaseId && dataSources.length > 0) {
            setDataSourcesExpanded(prev => !prev);
            return;
        }

        // Load data sources
        setLoadingDataSourcesFor(databaseId);
        setStatus("Loading data sources...");

        try {
            const data = await apiGetDataSources(databaseId);
            setDataSources(data);
            setDataSourcesForDatabase(databaseId);
            setDataSourcesExpanded(true);
            if (data.length === 0) {
                setStatus("No data sources found in this database.");
            } else {
                setStatus(`Found ${data.length} data source(s).`);
            }
        } catch (e: any) {
            setStatus(`Load data sources failed: ${e?.message || "unknown"}`);
            setDataSources([]);
            setDataSourcesForDatabase(null);
            setDataSourcesExpanded(false);
        } finally {
            setLoadingDataSourcesFor(null);
        }
    }, [dataSourcesForDatabase, dataSources.length]);

    const clearResults = useCallback(() => {
        setResults([]);
        setSelected(null);
        setChildren([]);
        setChildrenForPage(null);
        setChildrenExpanded(false);
        setDataSources([]);
        setDataSourcesForDatabase(null);
        setDataSourcesExpanded(false);
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
        childrenExpanded,
        loadingChildrenFor,
        dataSources,
        dataSourcesForDatabase,
        dataSourcesExpanded,
        loadingDataSourcesFor,

        // Actions
        search,
        toggleChildren,
        toggleDataSources,
        clearResults,
    };
}

