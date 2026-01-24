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
        <div className="mt-2.5 p-2.5 border-2 border-blue-600 rounded-lg bg-gray-50">
            <div className="font-semibold mb-2">
                Fill in properties for: {schema.name || "(Untitled)"}
            </div>
            <div className="text-xs text-gray-500 mb-2.5">
                Properties in this data source:
            </div>

            {Object.entries(schema.properties || {}).map(([propName, propSchema]: [string, any]) => (
                <div key={propName} className="mb-2">
                    <div className="text-xs font-medium mb-1">
                        {propName} ({(propSchema as any).type})
                    </div>

                    {(propSchema as any).type === "rich_text" && (
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
                            className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded box-border"
                        />
                    )}

                    {(propSchema as any).type === "select" && (
                        <select
                            aria-label={propName}
                            value={values[propName]?.select?.name || ""}
                            onChange={(e) => {
                                onValuesChange({
                                    ...values,
                                    [propName]: e.target.value ? { select: { name: e.target.value } } : undefined
                                });
                            }}
                            className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded"
                        >
                            <option value="">Select {propName}</option>
                            {(propSchema as any).select?.options?.map((opt: any) => (
                                <option key={opt.name} value={opt.name}>{opt.name}</option>
                            ))}
                        </select>
                    )}

                    {(propSchema as any).type === "url" && (
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
                            className="w-full px-1.5 py-1 text-xs border border-gray-300 rounded box-border"
                        />
                    )}

                    {(propSchema as any).type === "title" && (
                        <div className="text-[10px] text-gray-400 italic">
                            (Will be set to page title automatically)
                        </div>
                    )}

                    {!["rich_text", "select", "title", "url"].includes((propSchema as any).type) && (
                        <div className="text-[10px] text-gray-400 italic">
                            {(propSchema as any).type} (not yet supported in form)
                        </div>
                    )}
                </div>
            ))}

            <div className="flex gap-2 mt-2.5">
                <button
                    onClick={onSubmit}
                    disabled={busy}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white border-none rounded cursor-pointer text-xs hover:bg-blue-700 disabled:opacity-50"
                >
                    Create Page
                </button>
                <button
                    onClick={onCancel}
                    disabled={busy}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded cursor-pointer text-xs hover:bg-gray-50 disabled:opacity-50"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
