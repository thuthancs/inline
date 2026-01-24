import type { Destination } from "../../types";

interface Props {
    destination: Destination | null;
    onClear: () => void;
}

export function DestinationCard({ destination, onClear }: Props) {
    return (
        <div className="border border-gray-200 p-2 rounded-lg mb-2.5">
            <div className="text-xs text-gray-500">Current destination</div>
            {!destination ? (
                <div className="mt-1.5 text-gray-500">None</div>
            ) : destination.mode === "append_to_selected" ? (
                <div className="mt-1.5">
                    <div><b>Direct:</b> {destination.pageTitle || "(Untitled)"}</div>
                </div>
            ) : (
                <div className="mt-1.5">
                    <div><b>Parent:</b> {destination.parentTitle || "(Untitled)"}</div>
                    <div><b>Child:</b> {destination.childTitle || "(Untitled)"}</div>
                </div>
            )}
            {destination && (
                <button
                    onClick={onClear}
                    className="mt-2 px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                >
                    Clear
                </button>
            )}
        </div>
    );
}
