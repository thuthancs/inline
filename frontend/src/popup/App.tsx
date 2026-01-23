import { useEffect, useMemo, useState } from "react";
import { apiCreatePage, apiSearch } from "../api";
import { DEST_KEY, type Destination, type SearchItem } from "../types";
import { getActiveTabInfo } from "../util";

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

export default function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchItem[]>([]);
  const [selected, setSelected] = useState<SearchItem | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);

  const [status, setStatus] = useState<string>(""); // simple status line
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await storageGet<Destination>(DEST_KEY);
      setDestination(d);
    })();
  }, []);

  const pageResults = useMemo(
    () => results.filter((r) => r.type === "page"),
    [results]
  );

  async function onSearch() {
    const q = query.trim();
    if (!q) return;
    setStatus("");
    setBusy(true);
    setSelected(null);
    try {
      const data = await apiSearch(q);
      setResults(data);
      if (data.length === 0) setStatus("No results.");
    } catch (e: any) {
      setStatus(`Search failed: ${e?.message || "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function chooseSaveDirect() {
    if (!selected) return;

    const pageId = selected.id;
    if (!pageId) {
      setStatus("Search result missing id.");
      return;
    }

    const d: Destination = {
      mode: "append_to_selected",
      pageId,
      pageTitle: selected.title,
      pageUrl: selected.url ?? undefined,
      setAt: Date.now(),
    };

    await storageSet(DEST_KEY, d);
    setDestination(d);
    setStatus("Destination saved: direct append.");
  }


  async function chooseCreateChild() {
    if (!selected) return;

    const parentPageId = selected.id;
    if (!parentPageId) {
      setStatus("Search result missing id.");
      return;
    }

    setBusy(true);
    setStatus("Creating child page…");
    try {
      const tab = await getActiveTabInfo();
      const title = tab.title || "Saved Article";

      const created = await apiCreatePage(parentPageId, title);
      const childPageId = String(created?.id || "");
      const childUrl = created?.url;

      if (!childPageId) throw new Error("Server did not return new page id.");

      const d: Destination = {
        mode: "append_to_child",
        parentPageId,
        parentTitle: selected.title,
        childPageId,
        childTitle: title,
        childUrl,
        setAt: Date.now(),
      };

      await storageSet(DEST_KEY, d);
      setDestination(d);
      setStatus("Destination saved: child page created.");
    } catch (e: any) {
      setStatus(`Create child page failed: ${e?.message || "unknown"}`);
    } finally {
      setBusy(false);
    }
  }


  async function clearDest() {
    await storageRemove(DEST_KEY);
    setDestination(null);
    setStatus("Cleared destination.");
  }

  return (
    <div style={{ width: 360, padding: 12, fontFamily: "system-ui" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Inline (Minimal)</div>

      <div style={{ border: "1px solid #eee", padding: 8, borderRadius: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: "#666" }}>Current destination</div>
        {!destination ? (
          <div style={{ marginTop: 6, color: "#666" }}>None</div>
        ) : destination.mode === "append_to_selected" ? (
          <div style={{ marginTop: 6 }}>
            <div><b>Direct:</b> {destination.pageTitle || destination.pageId}</div>
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            <div><b>Parent:</b> {destination.parentTitle || destination.parentPageId}</div>
            <div><b>Child:</b> {destination.childTitle || destination.childPageId}</div>
          </div>
        )}
        {destination && (
          <button onClick={clearDest} style={{ marginTop: 8 }}>
            Clear
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="Search Notion…"
          style={{ flex: 1 }}
        />
        <button onClick={onSearch} disabled={busy}>
          Search
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        {pageResults.map((r, idx) => {
          const isSel = selected === r;
          return (
            <div
              key={`${r.title}-${idx}`}
              onClick={() => setSelected(r)}
              style={{
                padding: 8,
                border: "1px solid #ddd",
                borderRadius: 8,
                marginBottom: 8,
                background: isSel ? "#f5f5f5" : "white",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: 600 }}>{r.title || "(Untitled)"}</div>
              <div style={{ fontSize: 12, color: "#666" }}>{r.url}</div>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
        <div style={{ fontSize: 12, color: "#666" }}>After selecting a page:</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={chooseSaveDirect} disabled={!selected || busy}>
            Save directly
          </button>
          <button onClick={chooseCreateChild} disabled={!selected || busy}>
            Create child page
          </button>
        </div>
      </div>

      {status && <div style={{ marginTop: 10, fontSize: 12, color: "#444" }}>{status}</div>}
    </div>
  );
}
