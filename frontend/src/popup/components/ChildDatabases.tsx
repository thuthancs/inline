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
        <div className="mt-2.5 pt-2.5 border-t border-gray-200">
            <div className="text-xs text-gray-500 mb-2">
                Child databases:
            </div>
            {children.map((c, idx) => (
                <SearchResultItem
                    key={`child-${c.id}-${idx}`}
                    item={c}
                    isSelected={selected === c}
                    onSelect={() => onSelect(c)}
                    badgeColor="bg-blue-100"
                    isLoadingDataSources={loadingDataSourcesFor === c.id}
                    onLoadDataSources={c.type === "database" ? () => onLoadDataSources(c.id) : undefined}
                />
            ))}
        </div>
    );
}
