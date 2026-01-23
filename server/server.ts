import { Client } from "@notionhq/client";
import cors from "cors";
import { config } from "dotenv";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getTitle } from "./helpers/getTitle.js";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Serve frontend
const CLIENT_DIR = path.join(__dirname, "..", "inline-client");
app.use(express.static(CLIENT_DIR));

app.get("/", (_req, res) => {
    res.sendFile(path.join(CLIENT_DIR, "index.html"));
});

// Notion SDK
const notion = new Client({ auth: process.env.NOTION_KEY });

/* NOTION API ENDPOINTS 
    - Search pages, databases, and data sources
    - Create a child page in a parent page
    - Append a block to a page
    - Add a comment to a block
*/

// Search Notion and return titles
app.post("/search", async (req, res) => {
    try {
        const query = String(req.body?.query).trim();
        const response = await notion.search({ query });

        const results = await Promise.all(
            response.results.map(async (item: any) => {
                if (item.object === "page") {
                    const page = await notion.pages.retrieve({ page_id: item.id });
                    console.log(page)

                    return {
                        id: item.id,
                        type: "page",
                        title: getTitle(page),
                        url: (page as any).url,
                    };
                }

                if (item.object === "data_source") {
                    return {
                        id: item.id,
                        type: "data_source",
                        title: getTitle(item),
                        url: item.url ?? null,
                    };
                }

                if (item.object === "database") {
                    return {
                        id: item.id,
                        type: "database",
                        title: getTitle(item),
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
        return res.json(results);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Notion search failed" });
    }
});

// TODO: Create a child page in a parent page/datasource
app.post("/create-page", async (req, res) => {
    try {
        const parent_id = String(req.body?.parent_id ?? "").trim();
        const title = String(req.body?.title ?? "").trim();

        if (!parent_id) return res.status(400).json({ error: "parent_id is required" });
        if (!title) return res.status(400).json({ error: "title is required" });

        const response = await notion.pages.create({
            parent: { page_id: parent_id },
            properties: {
                title: {
                    title: [
                        {
                            type: "text",
                            text: { content: title },
                        },
                    ],
                },
            },
        });
        console.log(response)
        return res.json(response);
    } catch (e: any) {
        console.error(e);
        // bubble Notion message if present (helps debugging)
        return res.status(e?.status || 500).json({
            error: e?.message || "Failed to create page",
        });
    }
});


// TODO: Append a block to a page
app.patch("/save", async (req, res) => {
    try {
        const page_id = String(req.body?.page_id ?? "").trim();
        const content = String(req.body?.content ?? "").trim();

        if (!page_id) return res.status(400).json({ error: "Missing page_id" });
        if (!content) return res.status(400).json({ error: "Missing content" });

        console.log("[SAVE] page_id:", page_id, "content:", content.slice(0, 80));

        const response = await notion.blocks.children.append({
            block_id: page_id, // page id is valid as a block_id
            children: [
                {
                    object: "block",
                    type: "paragraph",
                    paragraph: {
                        rich_text: [
                            {
                                type: "text",
                                text: { content },
                            },
                        ],
                    },
                },
            ],
        });

        console.log("[SAVE] appended:", response?.results?.[0]?.id);
        return res.json(response);
    } catch (e: any) {
        console.error("[SAVE] error:", e?.body ?? e);
        return res.status(500).json({
            error: e?.body?.message ?? e?.message ?? "Failed to save content",
        });
    }
});



// TODO: Add a comment to a block
app.post("/comment", async (req, res) => {
    try {
        const block_id = String(req.body?.block_id).trim();
        const comment_text = String(req.body?.comment_text).trim();

        const response = await notion.comments.create({
            parent: {
                type: "block_id",
                block_id: block_id,
            },
            rich_text: [
                {
                    type: "text",
                    text: {
                        content: comment_text,
                    },
                },
            ],
        });

        return res.json(response);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to add comment" });
    }
})

// TODO: Add an endpoint to answer user question about a specific text

app.listen(PORT, () => {
    console.log(`Your app is listening on port ${PORT}`);
});