import { useState } from "react";
import { apiCreatePage, apiGetDataSource } from "../api";
import type { Destination } from "../types";
import { getActiveTabInfo } from "../util";

// Hooks
import { useAuth } from "./hooks/useAuth";
import { useDestination } from "./hooks/useDestination";
import { useSearch } from "./hooks/useSearch";

// Components
import { DestinationCard } from "./components/DestinationCard";
import { PropertyForm } from "./components/PropertyForm";
import { SearchBar } from "./components/SearchBar";
import { SearchResultItem } from "./components/SearchResultItem";

export default function App() {
  // Auth state
  const { isConnected, workspaceName, workspaceIcon, loading: authLoading, connectNotion, disconnect } = useAuth();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const { destination, save: saveDestination, clear: clearDestination } = useDestination();

  const {
    query,
    setQuery,
    results,
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
    search,
    toggleChildren,
    toggleDataSources,
    clearResults,
  } = useSearch();

  // Property form state
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [dataSourceSchema, setDataSourceSchema] = useState<any>(null);
  const [propertyValues, setPropertyValues] = useState<{ [key: string]: any }>({});

  async function handleConnect() {
    setConnecting(true);
    setConnectError(null);
    try {
      await connectNotion();
    } catch (e: any) {
      setConnectError(e?.message || "Failed to connect to Notion");
    } finally {
      setConnecting(false);
    }
  }

  async function handleSaveDirect() {
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

    await saveDestination(d);
    clearResults();
    setStatus("Destination saved: direct append.");
  }

  async function handleCreateChild() {
    if (!selected) return;

    const parentPageId = selected.id;
    const parentType = selected.type;
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

        // Auto-fill URL property with current page URL
        const tab = await getActiveTabInfo();
        const initialValues: { [key: string]: any } = {};
        for (const [propName, propSchema] of Object.entries(dataSource.properties || {})) {
          if ((propSchema as any).type === "url" && tab.url) {
            initialValues[propName] = { url: tab.url };
          }
        }
        setPropertyValues(initialValues);

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

      await saveDestination(d);
      clearResults();
      setStatus("Destination saved: child page created.");
    } catch (e: any) {
      setStatus(`Create child page failed: ${e?.message || "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  async function handlePropertyFormSubmit() {
    if (!selected || !dataSourceSchema) return;

    setBusy(true);
    setStatus("Creating page with properties...");
    try {
      const tab = await getActiveTabInfo();
      const title = tab.title || "Saved Article";

      // Build properties object with values from form
      const properties: any = {};

      for (const [propName, propSchema] of Object.entries(dataSourceSchema.properties || {})) {
        const prop: any = propSchema;
        if (prop.type === "title") {
          properties[propName] = {
            title: [{ type: "text", text: { content: title } }]
          };
        } else if (propertyValues[propName] !== undefined) {
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

      await saveDestination(d);
      clearResults();
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

  function handlePropertyFormCancel() {
    setShowPropertyForm(false);
    setDataSourceSchema(null);
    setPropertyValues({});
  }

  async function handleClearDestination() {
    await clearDestination();
    setStatus("Cleared destination.");
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="w-full max-w-md p-6 font-sans flex items-center justify-center min-h-[200px]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Not connected - show connect screen
  if (!isConnected) {
    return (
      <div className="w-full max-w-md p-6 font-sans">
        <div className="text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold mb-2 text-gray-800">Welcome to Inline</h1>
          <p className="text-gray-600 mb-6 text-sm">
            Connect your Notion workspace to start saving highlights and comments from any webpage.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {connecting ? "Connecting..." : "Connect to Notion"}
          </button>
          {connectError && (
            <p className="mt-3 text-red-500 text-sm">{connectError}</p>
          )}
        </div>
      </div>
    );
  }

  // Connected - show main UI
  return (
    <div className="w-full max-w-md p-3 font-sans">
      {/* Workspace indicator */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {workspaceIcon && (
            <img src={workspaceIcon} alt="" className="w-5 h-5 rounded" />
          )}
          <span className="text-xs text-gray-600">
            Connected to <strong className="text-gray-800">{workspaceName || "Notion"}</strong>
          </span>
        </div>
        <button
          onClick={disconnect}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Disconnect
        </button>
      </div>

      <DestinationCard
        destination={destination}
        onClear={handleClearDestination}
      />

      <SearchBar
        query={query}
        onQueryChange={setQuery}
        onSearch={search}
        busy={busy}
      />

      {/* Selected Item - show hierarchical structure */}
      {selected && (
        <div className="mt-2.5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-500">Selected destination:</span>
            <button
              onClick={() => setSelected(null)}
              className="text-xs px-2 py-0.5 cursor-pointer bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
            >
              Change
            </button>
          </div>

          {/* Hierarchical tree structure with toggles */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Level 0: Selected Page/Database/DataSource */}
            <div
              className={`p-2.5 ${selected.type === "data_source" ? "bg-yellow-50" : selected.type === "database" ? "bg-blue-50" : "bg-gray-50"}`}
            >
              <div className="flex items-center gap-2">
                <div className="font-semibold flex-1">{selected.title || "(Untitled)"}</div>
                <span className={`text-[10px] text-gray-500 px-1.5 py-0.5 rounded ${selected.type === "data_source" ? "bg-yellow-100" : selected.type === "database" ? "bg-blue-100" : "bg-gray-100"}`}>
                  {selected.type}
                </span>
              </div>

              {/* Toggle for child databases */}
              {selected.type === "page" && (
                <div
                  onClick={() => toggleChildren(selected.id)}
                  className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer hover:text-gray-900"
                >
                  <span className={`transition-transform ${childrenExpanded ? "rotate-90" : ""}`}>▶</span>
                  <span>{loadingChildrenFor === selected.id ? "Loading..." : "Databases"}</span>
                  {children.length > 0 && <span className="text-gray-400">({children.length})</span>}
                </div>
              )}

              {/* Toggle for data sources (when selected is a database) */}
              {selected.type === "database" && (
                <div
                  onClick={() => toggleDataSources(selected.id)}
                  className="mt-2 flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer hover:text-gray-900"
                >
                  <span className={`transition-transform ${dataSourcesExpanded ? "rotate-90" : ""}`}>▶</span>
                  <span>{loadingDataSourcesFor === selected.id ? "Loading..." : "Data sources"}</span>
                  {dataSources.length > 0 && <span className="text-gray-400">({dataSources.length})</span>}
                </div>
              )}
            </div>

            {/* Level 1: Child Databases (nested under page) */}
            {childrenExpanded && children.length > 0 && (
              <div className="border-t border-gray-200 bg-white">
                {children.map((child, idx) => (
                  <div key={`child-${child.id}-${idx}`} className="border-b border-gray-100 last:border-b-0">
                    <div
                      className={`p-2 pl-5 cursor-pointer hover:bg-gray-50 ${selected.id === child.id ? "bg-blue-50" : ""}`}
                      onClick={() => setSelected(child)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-medium flex-1 text-sm">{child.title || "(Untitled)"}</div>
                        <span className="text-[10px] text-gray-500 px-1.5 py-0.5 bg-blue-100 rounded">
                          {child.type}
                        </span>
                      </div>

                      {/* Toggle for data sources */}
                      {child.type === "database" && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDataSources(child.id);
                          }}
                          className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer hover:text-gray-700"
                        >
                          <span className={`transition-transform ${dataSourcesForDatabase === child.id && dataSourcesExpanded ? "rotate-90" : ""}`}>▶</span>
                          <span>{loadingDataSourcesFor === child.id ? "Loading..." : "Data sources"}</span>
                          {dataSourcesForDatabase === child.id && dataSources.length > 0 && <span className="text-gray-400">({dataSources.length})</span>}
                        </div>
                      )}
                    </div>

                    {/* Level 2: Data Sources (nested under this database) */}
                    {dataSourcesForDatabase === child.id && dataSourcesExpanded && dataSources.length > 0 && (
                      <div className="bg-gray-50">
                        {dataSources.map((ds, dsIdx) => (
                          <div
                            key={`ds-${ds.id}-${dsIdx}`}
                            className={`p-2 pl-10 cursor-pointer hover:bg-gray-100 border-t border-gray-100 ${selected.id === ds.id ? "bg-yellow-100" : ""}`}
                            onClick={() => setSelected(ds)}
                          >
                            <div className="flex items-center gap-2">
                              <div className="font-medium flex-1 text-sm">{ds.title || "(Untitled)"}</div>
                              <span className="text-[10px] text-gray-500 px-1.5 py-0.5 bg-yellow-100 rounded">
                                {ds.type}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Data Sources directly under selected database (when selected is a database) */}
            {selected.type === "database" && dataSourcesForDatabase === selected.id && dataSourcesExpanded && dataSources.length > 0 && (
              <div className="border-t border-gray-200 bg-gray-50">
                {dataSources.map((ds, dsIdx) => (
                  <div
                    key={`ds-direct-${ds.id}-${dsIdx}`}
                    className={`p-2 pl-5 cursor-pointer hover:bg-gray-100 border-b border-gray-100 last:border-b-0 ${selected.id === ds.id ? "bg-yellow-100" : ""}`}
                    onClick={() => setSelected(ds)}
                  >
                    <div className="flex items-center gap-2">
                      <div className="font-medium flex-1 text-sm">{ds.title || "(Untitled)"}</div>
                      <span className="text-[10px] text-gray-500 px-1.5 py-0.5 bg-yellow-100 rounded">
                        {ds.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Results - only show if nothing selected */}
      {!selected && results.length > 0 && (
        <div className="mt-2.5">
          {results.map((r, idx) => (
            <SearchResultItem
              key={`${r.id}-${idx}`}
              item={r}
              isSelected={false}
              onSelect={() => setSelected(r)}
              isLoadingChildren={loadingChildrenFor === r.id}
              onLoadChildren={r.type === "page" ? () => toggleChildren(r.id) : undefined}
            />
          ))}
        </div>
      )}

      {showPropertyForm && (
        <PropertyForm
          schema={dataSourceSchema}
          values={propertyValues}
          onValuesChange={setPropertyValues}
          onSubmit={handlePropertyFormSubmit}
          onCancel={handlePropertyFormCancel}
          busy={busy}
        />
      )}

      {/* Action Buttons - only show when an item is selected and property form is not shown */}
      {selected && !showPropertyForm && (
        <div className="border-t border-gray-200 pt-2.5 mt-2.5">
          <div className="flex gap-2">
            <button
              onClick={handleSaveDirect}
              disabled={busy}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
            >
              Save directly
            </button>
            <button
              onClick={handleCreateChild}
              disabled={busy}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Create child page
            </button>
          </div>
        </div>
      )}

      {/* Status */}
      {status && <div className="mt-2.5 text-xs text-gray-600">{status}</div>}
    </div>
  );
}
