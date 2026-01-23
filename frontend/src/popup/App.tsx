import { useEffect, useMemo, useState } from "react";
import { apiCreatePage, apiGetChildren, apiGetDataSource, apiGetDataSources, apiSearch } from "../api";
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

  const [children, setChildren] = useState<SearchItem[]>([]);
  const [loadingChildrenFor, setLoadingChildrenFor] = useState<string | null>(null);

  const [dataSources, setDataSources] = useState<SearchItem[]>([]);
  const [loadingDataSourcesFor, setLoadingDataSourcesFor] = useState<string | null>(null);

  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [dataSourceSchema, setDataSourceSchema] = useState<any>(null);
  const [propertyValues, setPropertyValues] = useState<{ [key: string]: any }>({});

  const [status, setStatus] = useState<string>(""); // simple status line
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await storageGet<Destination>(DEST_KEY);
      setDestination(d);
    })();
  }, []);

  const pageResults = useMemo(
    () => results.filter((r) => r.type === "page" || r.type === "database" || r.type === "data_source"),
    [results]
  );

  async function onSearch() {
    const q = query.trim();
    if (!q) return;
    setStatus("");
    setBusy(true);
    setSelected(null);
    setChildren([]);
    setLoadingChildrenFor(null);
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

  async function loadChildren(pageId: string) {
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
  }

  async function loadDataSources(databaseId: string) {
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
    const parentType = selected.type; // "page", "database", or "data_source"
    if (!parentPageId) {
      setStatus("Search result missing id.");
      return;
    }

    // If it's a data source, show property form
    if (parentType === "data_source") {
      setBusy(true);
      setStatus("Loading data source properties...");
      try {
        const dataSource = await apiGetDataSource(parentPageId);
        setDataSourceSchema(dataSource);
        setShowPropertyForm(true);
        setStatus("");
      } catch (e: any) {
        setStatus(`Failed to load properties: ${e?.message || "unknown"}`);
      } finally {
        setBusy(false);
      }
      return;
    }

    // For pages and databases, create directly
    setBusy(true);
    setStatus("Creating child page…");
    try {
      const tab = await getActiveTabInfo();
      const title = tab.title || "Saved Article";

      const created = await apiCreatePage(parentPageId, title, parentType);
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

  async function submitPropertyForm() {
    if (!selected || !dataSourceSchema) return;

    setBusy(true);
    setStatus("Creating page with properties...");
    try {
      const tab = await getActiveTabInfo();
      const title = tab.title || "Saved Article";

      // Build properties object with values from form
      const properties: any = {};

      // Find the title property and set it
      for (const [propName, propSchema] of Object.entries(dataSourceSchema.properties || {})) {
        const prop: any = propSchema;
        if (prop.type === "title") {
          properties[propName] = {
            title: [{ type: "text", text: { content: title } }]
          };
        } else if (propertyValues[propName] !== undefined) {
          // Add other property values from the form
          properties[propName] = propertyValues[propName];
        }
      }

      const created = await apiCreatePage(selected.id, title, "data_source", properties);
      const childPageId = String(created?.id || "");
      const childUrl = created?.url;

      if (!childPageId) throw new Error("Server did not return new page id.");

      const d: Destination = {
        mode: "append_to_child",
        parentPageId: selected.id,
        parentTitle: selected.title,
        childPageId,
        childTitle: title,
        childUrl,
        setAt: Date.now(),
      };

      await storageSet(DEST_KEY, d);
      setDestination(d);
      setStatus("Destination saved: page created with properties.");
      setShowPropertyForm(false);
      setDataSourceSchema(null);
      setPropertyValues({});
    } catch (e: any) {
      setStatus(`Create page failed: ${e?.message || "unknown"}`);
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
          const isLoadingChildren = loadingChildrenFor === r.id;
          return (
            <div
              key={`${r.title}-${idx}`}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                marginBottom: 8,
                background: isSel ? "#f5f5f5" : "white",
              }}
            >
              <div
                onClick={() => setSelected(r)}
                style={{
                  padding: 8,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 600, flex: 1 }}>{r.title || "(Untitled)"}</div>
                  <span style={{
                    fontSize: 10,
                    color: "#999",
                    padding: "2px 6px",
                    background: "#f0f0f0",
                    borderRadius: 4
                  }}>
                    {r.type}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>{r.url}</div>
              </div>
              {r.type === "page" && (
                <div style={{ padding: "0 8px 8px 8px" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      loadChildren(r.id);
                    }}
                    disabled={isLoadingChildren}
                    style={{
                      fontSize: 11,
                      padding: "4px 8px",
                      width: "100%",
                      background: "#f9f9f9",
                      border: "1px solid #ddd",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    {isLoadingChildren ? "Loading..." : "View child databases"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {children.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            Child databases:
          </div>
          {children.map((c, idx) => {
            const isSel = selected === c;
            const isLoadingDataSources = loadingDataSourcesFor === c.id;
            return (
              <div
                key={`child-${c.id}-${idx}`}
                style={{
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  marginBottom: 8,
                  background: isSel ? "#f5f5f5" : "white",
                }}
              >
                <div
                  onClick={() => setSelected(c)}
                  style={{
                    padding: 8,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 600, flex: 1 }}>{c.title || "(Untitled)"}</div>
                    <span style={{
                      fontSize: 10,
                      color: "#999",
                      padding: "2px 6px",
                      background: "#e3f2fd",
                      borderRadius: 4
                    }}>
                      {c.type}
                    </span>
                  </div>
                </div>
                {c.type === "database" && (
                  <div style={{ padding: "0 8px 8px 8px" }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        loadDataSources(c.id);
                      }}
                      disabled={isLoadingDataSources}
                      style={{
                        fontSize: 11,
                        padding: "4px 8px",
                        width: "100%",
                        background: "#f9f9f9",
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      {isLoadingDataSources ? "Loading..." : "View data sources"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dataSources.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee" }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
            Data sources:
          </div>
          {dataSources.map((ds, idx) => {
            const isSel = selected === ds;
            return (
              <div
                key={`datasource-${ds.id}-${idx}`}
                onClick={() => setSelected(ds)}
                style={{
                  padding: 8,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                  marginBottom: 8,
                  background: isSel ? "#f5f5f5" : "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>{ds.title || "(Untitled)"}</div>
                  <span style={{
                    fontSize: 10,
                    color: "#999",
                    padding: "2px 6px",
                    background: "#fff3cd",
                    borderRadius: 4
                  }}>
                    {ds.type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPropertyForm && dataSourceSchema && (
        <div style={{
          marginTop: 10,
          padding: 10,
          border: "2px solid #0066cc",
          borderRadius: 8,
          background: "#f9f9f9"
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            Fill in properties for: {dataSourceSchema.name || "(Untitled)"}
          </div>
          <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>
            Properties in this data source:
          </div>
          {Object.entries(dataSourceSchema.properties || {}).map(([propName, propSchema]: [string, any]) => (
            <div key={propName} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
                {propName} ({propSchema.type})
              </div>
              {propSchema.type === "rich_text" && (
                <input
                  type="text"
                  placeholder={`Enter ${propName}`}
                  value={propertyValues[propName]?.rich_text?.[0]?.text?.content || ""}
                  onChange={(e) => {
                    setPropertyValues({
                      ...propertyValues,
                      [propName]: {
                        rich_text: [{ type: "text", text: { content: e.target.value } }]
                      }
                    });
                  }}
                  style={{
                    width: "100%",
                    padding: "4px 6px",
                    fontSize: 11,
                    border: "1px solid #ddd",
                    borderRadius: 4
                  }}
                />
              )}
              {propSchema.type === "select" && (
                <select
                  value={propertyValues[propName]?.select?.name || ""}
                  onChange={(e) => {
                    setPropertyValues({
                      ...propertyValues,
                      [propName]: e.target.value ? { select: { name: e.target.value } } : undefined
                    });
                  }}
                  style={{
                    width: "100%",
                    padding: "4px 6px",
                    fontSize: 11,
                    border: "1px solid #ddd",
                    borderRadius: 4
                  }}
                >
                  <option value="">Select {propName}</option>
                  {propSchema.select?.options?.map((opt: any) => (
                    <option key={opt.name} value={opt.name}>{opt.name}</option>
                  ))}
                </select>
              )}
              {propSchema.type === "title" && (
                <div style={{ fontSize: 10, color: "#999", fontStyle: "italic" }}>
                  (Will be set to page title automatically)
                </div>
              )}
              {!["rich_text", "select", "title"].includes(propSchema.type) && (
                <div style={{ fontSize: 10, color: "#999", fontStyle: "italic" }}>
                  {propSchema.type} (not yet supported in form)
                </div>
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={submitPropertyForm}
              disabled={busy}
              style={{
                flex: 1,
                padding: "6px 12px",
                background: "#0066cc",
                color: "white",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              Create Page
            </button>
            <button
              onClick={() => {
                setShowPropertyForm(false);
                setDataSourceSchema(null);
                setPropertyValues({});
              }}
              disabled={busy}
              style={{
                padding: "6px 12px",
                background: "white",
                border: "1px solid #ddd",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
        <div style={{ fontSize: 12, color: "#666" }}>After selecting a destination:</div>
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
