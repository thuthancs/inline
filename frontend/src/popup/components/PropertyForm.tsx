interface Props {
    schema: any;
    values: { [key: string]: any };
    onValuesChange: (values: { [key: string]: any }) => void;
    onSubmit: () => void;
    onCancel: () => void;
    busy: boolean;
}

export function PropertyForm({
    schema,
    values,
    onValuesChange,
    onSubmit,
    onCancel,
    busy,
}: Props) {
    if (!schema) return null;

    return (
        <div style={{
            marginTop: 10,
            padding: 10,
            border: "2px solid #0066cc",
            borderRadius: 8,
            background: "#f9f9f9"
        }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
                Fill in properties for: {schema.name || "(Untitled)"}
            </div>
            <div style={{ fontSize: 11, color: "#666", marginBottom: 10 }}>
                Properties in this data source:
            </div>

            {Object.entries(schema.properties || {}).map(([propName, propSchema]: [string, any]) => (
                <div key={propName} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 4 }}>
                        {propName} ({propSchema.type})
                    </div>

                    {propSchema.type === "rich_text" && (
                        <input
                            type="text"
                            placeholder={`Enter ${propName}`}
                            value={values[propName]?.rich_text?.[0]?.text?.content || ""}
                            onChange={(e) => {
                                onValuesChange({
                                    ...values,
                                    [propName]: {
                                        rich_text: [{ type: "text", text: { content: e.target.value } }]
                                    }
                                });
                            }}
                            style={{
                                width: "100%",
                                padding: "4px 6px",
                                fontSize: 11,
                                border: "1px solid #ddd",
                                borderRadius: 4,
                                boxSizing: "border-box",
                            }}
                        />
                    )}

                    {propSchema.type === "select" && (
                        <select
                            value={values[propName]?.select?.name || ""}
                            onChange={(e) => {
                                onValuesChange({
                                    ...values,
                                    [propName]: e.target.value ? { select: { name: e.target.value } } : undefined
                                });
                            }}
                            style={{
                                width: "100%",
                                padding: "4px 6px",
                                fontSize: 11,
                                border: "1px solid #ddd",
                                borderRadius: 4
                            }}
                        >
                            <option value="">Select {propName}</option>
                            {propSchema.select?.options?.map((opt: any) => (
                                <option key={opt.name} value={opt.name}>{opt.name}</option>
                            ))}
                        </select>
                    )}

                    {propSchema.type === "url" && (
                        <input
                            type="url"
                            placeholder={`Enter ${propName}`}
                            value={values[propName]?.url || ""}
                            onChange={(e) => {
                                onValuesChange({
                                    ...values,
                                    [propName]: { url: e.target.value || null }
                                });
                            }}
                            style={{
                                width: "100%",
                                padding: "4px 6px",
                                fontSize: 11,
                                border: "1px solid #ddd",
                                borderRadius: 4,
                                boxSizing: "border-box",
                            }}
                        />
                    )}

                    {propSchema.type === "title" && (
                        <div style={{ fontSize: 10, color: "#999", fontStyle: "italic" }}>
                            (Will be set to page title automatically)
                        </div>
                    )}

                    {!["rich_text", "select", "title", "url"].includes(propSchema.type) && (
                        <div style={{ fontSize: 10, color: "#999", fontStyle: "italic" }}>
                            {propSchema.type} (not yet supported in form)
                        </div>
                    )}
                </div>
            ))}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                    onClick={onSubmit}
                    disabled={busy}
                    style={{
                        flex: 1,
                        padding: "6px 12px",
                        background: "#0066cc",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12
                    }}
                >
                    Create Page
                </button>
                <button
                    onClick={onCancel}
                    disabled={busy}
                    style={{
                        padding: "6px 12px",
                        background: "white",
                        border: "1px solid #ddd",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

