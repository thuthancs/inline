import type { SearchItem } from "../../types";
import { SearchResultItem } from "./SearchResultItem";

interface Props {
    dataSources: SearchItem[];
    selected: SearchItem | null;
    onSelect: (item: SearchItem) => void;
}

export function DataSourcesList({ dataSources, selected, onSelect }: Props) {
    if (dataSources.length === 0) return null;

    return (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #eee" }}>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
                Data sources:
            </div>
            {dataSources.map((ds, idx) => (
                <SearchResultItem
                    key={`datasource-${ds.id}-${idx}`}
                    item={ds}
                    isSelected={selected === ds}
                    onSelect={() => onSelect(ds)}
                    badgeColor="#fff3cd"
                />
            ))}
        </div>
    );
}

