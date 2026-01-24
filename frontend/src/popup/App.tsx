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
    clearResults,
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

  return (
    <div className="w-full max-w-md p-3 font-sans">
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

      {/* Selected Item - show only the selected card */}
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
          <SearchResultItem
            key={selected.id}
            item={selected}
            isSelected={true}
            onSelect={() => { }}
            isLoadingChildren={loadingChildrenFor === selected.id}
            onLoadChildren={selected.type === "page" ? () => loadChildren(selected.id) : undefined}
            isLoadingDataSources={loadingDataSourcesFor === selected.id}
            onLoadDataSources={selected.type === "database" ? () => loadDataSources(selected.id) : undefined}
            badgeColor={
              children.includes(selected) ? "bg-blue-100" :
                dataSources.includes(selected) ? "bg-yellow-100" : "bg-gray-100"
            }
          />
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
              onLoadChildren={r.type === "page" ? () => loadChildren(r.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Children - only show if nothing selected */}
      {!selected && (
        <ChildDatabases
          children={children}
          selected={null}
          onSelect={setSelected}
          loadingDataSourcesFor={loadingDataSourcesFor}
          onLoadDataSources={loadDataSources}
        />
      )}

      {/* Data Sources - only show if nothing selected */}
      {!selected && (
        <DataSourcesList
          dataSources={dataSources}
          selected={null}
          onSelect={setSelected}
        />
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
