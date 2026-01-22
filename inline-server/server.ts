import { Client } from "@notionhq/client";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT ?? 64707);

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Serve frontend
const CLIENT_DIR = path.join(__dirname, "..", "inline-client");
app.use(express.static(CLIENT_DIR));

app.get("/", (_req, res) => {
    res.sendFile(path.join(CLIENT_DIR, "index.html"));
});

app.get("/favicon.ico", (_req, res) => res.sendStatus(204));

// Notion SDK
const notion = new Client({ auth: process.env.NOTION_KEY });

/**
 * Robustly extract a Notion page title:
 * - For database pages, the title is stored in the DB title property (name varies).
 * - For non-database pages, there is still a title property somewhere in properties.
 */
function getTitleFromPage(page: any): string {
    const props = page?.properties;
    if (!props || typeof props !== "object") return "(Untitled)";

    // Find the property whose type is "title"
    const titleProp = Object.values(props).find((p: any) => p?.type === "title");
    const titleArr = (titleProp as any)?.title;

    if (Array.isArray(titleArr) && titleArr.length > 0) {
        return titleArr.map((t: any) => t?.plain_text ?? "").join("").trim() || "(Untitled)";
    }

    return "(Untitled)";
}

function getDataSourceName(ds: any): string {
    return (ds.title ?? []).map((t: any) => t.plain_text).join("") || "(Untitled)";
}

function getDatabaseName(db: any): string {
    return (db.title ?? []).map((t: any) => t.plain_text).join("") || "(Untitled)";
}




// Search Notion and return titles
app.post("/search", async (req, res) => {
    try {
        const query = String(req.body?.query ?? "").trim();
        if (!query) return res.status(400).json({ error: "Query is required" });

        const response = await notion.search({ query });

        const results = await Promise.all(
            response.results.map(async (item: any) => {
                if (item.object === "page") {
                    // Pages need a retrieve to get reliable titles
                    const page = await notion.pages.retrieve({ page_id: item.id });
                    console.log(page)
                    return {
                        type: "page",
                        title: getTitleFromPage(page),
                        url: (page as any).url,
                    };
                }

                if (item.object === "data_source") {
                    // Search returns a data_source object with `title`
                    return {
                        id: item.id,
                        type: "data_source",
                        title: getDataSourceName(item),
                        url: item.url ?? null,
                    };
                }

                if (item.object === "database") {
                    // Search returns a database object with `title`
                    return {
                        type: "database",
                        title: getDatabaseName(item),
                        url: item.url ?? null,
                    };
                }

                // Fallback for future object types
                return {
                    type: item.object ?? "unknown",
                    title: "(Unsupported object)",
                    url: item.url ?? null,
                };
            })
        );
        console.log(results)
        res.json(results);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Notion search failed" });
    }
});

app.listen(PORT, () => {
    console.log(`Your app is listening on port ${PORT}`);
});
