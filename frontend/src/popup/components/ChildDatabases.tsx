import type { SearchItem } from "../../types";
import { SearchResultItem } from "./SearchResultItem";

interface Props {
    children: SearchItem[];
    selected: SearchItem | null;
    onSelect: (item: SearchItem) => void;
    loadingDataSourcesFor: string | null;
    onLoadDataSources: (databaseId: string) => void;
}

export function ChildDatabases({
    children,
    selected,
    onSelect,
    loadingDataSourcesFor,
    onLoadDataSources,
}: Props) {
    if (children.length === 0) return null;

    return (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee" }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                Child databases:
            </div>
            {children.map((c, idx) => (
                <SearchResultItem
                    key={`child-${c.id}-${idx}`}
                    item={c}
                    isSelected={selected === c}
                    onSelect={() => onSelect(c)}
                    badgeColor="#e3f2fd"
                    isLoadingDataSources={loadingDataSourcesFor === c.id}
                    onLoadDataSources={c.type === "database" ? () => onLoadDataSources(c.id) : undefined}
                />
            ))}
        </div>
    );
}

