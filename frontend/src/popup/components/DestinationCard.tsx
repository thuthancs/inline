import type { Destination } from "../../types";

interface Props {
    destination: Destination | null;
    onClear: () => void;
}

export function DestinationCard({ destination, onClear }: Props) {
    return (
        <div style={{ border: "1px solid #eee", padding: 8, borderRadius: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: "#666" }}>Current destination</div>
            {!destination ? (
                <div style={{ marginTop: 6, color: "#666" }}>None</div>
            ) : destination.mode === "append_to_selected" ? (
                <div style={{ marginTop: 6 }}>
                    <div><b>Direct:</b> {destination.pageTitle || destination.pageId}</div>
                </div>
            ) : (
                <div style={{ marginTop: 6 }}>
                    <div><b>Parent:</b> {destination.parentTitle || destination.parentPageId}</div>
                    <div><b>Child:</b> {destination.childTitle || destination.childPageId}</div>
                </div>
            )}
            {destination && (
                <button onClick={onClear} style={{ marginTop: 8 }}>
                    Clear
                </button>
            )}
        </div>
    );
}

