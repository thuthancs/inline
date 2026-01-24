interface Props {
    query: string;
    onQueryChange: (query: string) => void;
    onSearch: () => void;
    busy: boolean;
}

export function SearchBar({ query, onQueryChange, onSearch, busy }: Props) {
    return (
        <div style={{ display: "flex", gap: 8 }}>
            <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                placeholder="Search Notion…"
                style={{ flex: 1 }}
            />
            <button onClick={onSearch} disabled={busy}>
                Search
            </button>
        </div>
    );
}

