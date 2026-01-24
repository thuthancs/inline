import type { SearchItem } from "../../types";

interface Props {
    item: SearchItem;
    isSelected: boolean;
    onSelect: () => void;
    isLoadingChildren?: boolean;
    onLoadChildren?: () => void;
    isLoadingDataSources?: boolean;
    onLoadDataSources?: () => void;
    badgeColor?: string;
}

export function SearchResultItem({
    item,
    isSelected,
    onSelect,
    isLoadingChildren,
    onLoadChildren,
    isLoadingDataSources,
    onLoadDataSources,
    badgeColor = "bg-gray-100",
}: Props) {
    return (
        <div className={`border border-gray-300 rounded-lg mb-2 ${isSelected ? "bg-gray-100" : "bg-white"}`}>
            <div
                onClick={onSelect}
                className="p-2 cursor-pointer"
            >
                <div className="flex items-center gap-2">
                    <div className="font-semibold flex-1">{item.title || "(Untitled)"}</div>
                    <span className={`text-[10px] text-gray-500 px-1.5 py-0.5 ${badgeColor} rounded`}>
                        {item.type}
                    </span>
                </div>
            </div>

            {item.type === "page" && onLoadChildren && (
                <div className="px-2 pb-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onLoadChildren();
                        }}
                        disabled={isLoadingChildren}
                        className="text-xs px-2 py-1 w-full bg-gray-50 border border-gray-300 rounded cursor-pointer hover:bg-gray-100 disabled:opacity-50"
                    >
                        {isLoadingChildren ? "Loading..." : "View child databases"}
                    </button>
                </div>
            )}

            {item.type === "database" && onLoadDataSources && (
                <div className="px-2 pb-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onLoadDataSources();
                        }}
                        disabled={isLoadingDataSources}
                        className="text-xs px-2 py-1 w-full bg-gray-50 border border-gray-300 rounded cursor-pointer hover:bg-gray-100 disabled:opacity-50"
                    >
                        {isLoadingDataSources ? "Loading..." : "View data sources"}
                    </button>
                </div>
            )}
        </div>
    );
}
