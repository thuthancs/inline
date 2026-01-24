interface Props {
    query: string;
    onQueryChange: (query: string) => void;
    onSearch: () => void;
    busy: boolean;
}

export function SearchBar({ query, onQueryChange, onSearch, busy }: Props) {
    return (
        <div className="flex gap-2">
            <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearch()}
                placeholder="Search Notion…"
                className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
                onClick={onSearch}
                disabled={busy}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
            >
                Search
            </button>
        </div>
    );
}
