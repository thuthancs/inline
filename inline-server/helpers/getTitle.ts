export function getTitle(item: any): string {
    if (item.object === "page") {
        const props = item?.properties;
        const titleProp = Object.values(props).find((p: any) => p?.type === "title");
        const titleArr = (titleProp as any)?.title;
        return titleArr.map((t: any) => t?.plain_text ?? "").join("").trim() || "(Untitled)";

    } else if (item.object === "database" || item.object === "data_source") {
        return (item.title).map((t: any) => t.plain_text).join("") || "(Untitled)";
    }
}