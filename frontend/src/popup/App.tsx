import { useState } from "react";
import { apiCreatePage, apiGetDataSource } from "../api";
import type { Destination } from "../types";
import { getActiveTabInfo } from "../util";

// Hooks
import { useDestination } from "./hooks/useDestination";
import { useSearch } from "./hooks/useSearch";

// Components
import { ChildDatabases } from "./components/ChildDatabases";
import { DataSourcesList } from "./components/DataSourcesList";
import { DestinationCard } from "./components/DestinationCard";
import { PropertyForm } from "./components/PropertyForm";
import { SearchBar } from "./components/SearchBar";
import { SearchResultItem } from "./components/SearchResultItem";

export default function App() {
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
    loadingChildrenFor,
    dataSources,
    loadingDataSourcesFor,
    search,
    loadChildren,
    loadDataSources,
  } = useSearch();

  // Property form state
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [dataSourceSchema, setDataSourceSchema] = useState<any>(null);
  const [propertyValues, setPropertyValues] = useState<{ [key: string]: any }>({});

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

  return (
    <div style={{ width: "100%", maxWidth: 400, padding: 12, fontFamily: "system-ui" }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Inline</div>

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

      {/* Search Results */}
      <div style={{ marginTop: 10 }}>
        {results.map((r, idx) => (
          <SearchResultItem
            key={`${r.id}-${idx}`}
            item={r}
            isSelected={selected === r}
            onSelect={() => setSelected(r)}
            isLoadingChildren={loadingChildrenFor === r.id}
            onLoadChildren={r.type === "page" ? () => loadChildren(r.id) : undefined}
          />
        ))}
      </div>

      <ChildDatabases
        children={children}
        selected={selected}
        onSelect={setSelected}
        loadingDataSourcesFor={loadingDataSourcesFor}
        onLoadDataSources={loadDataSources}
      />

      <DataSourcesList
        dataSources={dataSources}
        selected={selected}
        onSelect={setSelected}
      />

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

      {/* Action Buttons */}
      <div style={{ borderTop: "1px solid #eee", paddingTop: 10, marginTop: 10 }}>
        <div style={{ fontSize: 12, color: "#666" }}>After selecting a destination:</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button onClick={handleSaveDirect} disabled={!selected || busy}>
            Save directly
          </button>
          <button onClick={handleCreateChild} disabled={!selected || busy}>
            Create child page
          </button>
        </div>
      </div>

      {/* Status */}
      {status && <div style={{ marginTop: 10, fontSize: 12, color: "#444" }}>{status}</div>}
    </div>
  );
}
