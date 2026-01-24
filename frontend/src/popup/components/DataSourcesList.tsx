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
        <div className="mt-2.5 pt-2.5 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2">
                Data sources:
            </div>
            {dataSources.map((ds, idx) => (
                <SearchResultItem
                    key={`datasource-${ds.id}-${idx}`}
                    item={ds}
                    isSelected={selected === ds}
                    onSelect={() => onSelect(ds)}
                />
            ))}
        </div>
    );
}
