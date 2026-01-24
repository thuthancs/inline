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
    badgeColor = "#f0f0f0",
}: Props) {
    return (
        <div
            style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                marginBottom: 8,
                background: isSelected ? "#f5f5f5" : "white",
            }}
        >
            <div
                onClick={onSelect}
                style={{
                    padding: 8,
                    cursor: "pointer",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontWeight: 600, flex: 1 }}>{item.title || "(Untitled)"}</div>
                    <span style={{
                        fontSize: 10,
                        color: "#999",
                        padding: "2px 6px",
                        background: badgeColor,
                        borderRadius: 4
                    }}>
                        {item.type}
                    </span>
                </div>
                {item.url && <div style={{ fontSize: 12, color: "#666" }}>{item.url}</div>}
            </div>

            {item.type === "page" && onLoadChildren && (
                <div style={{ padding: "0 8px 8px 8px" }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onLoadChildren();
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

            {item.type === "database" && onLoadDataSources && (
                <div style={{ padding: "0 8px 8px 8px" }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onLoadDataSources();
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
}

