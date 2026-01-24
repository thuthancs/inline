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
const notion = new Client({
    auth: process.env.NOTION_KEY,
    notionVersion: "2025-09-03"
});

async function fetchImageAsBuffer(imageUrl: string) {
    console.log("[UPLOAD] Fetching image:", imageUrl);
    const resp = await fetch(imageUrl);
    if (!resp.ok) {
        throw new Error(`Failed to fetch image: ${resp.status} ${resp.statusText}`);
    }
    const contentType = resp.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const urlPath = new URL(imageUrl).pathname;
    const baseName = urlPath.split("/").pop() || "image";
    const extFromType = contentType.split("/")[1] || "jpg";
    const fileName = baseName.includes(".") ? baseName : `${baseName}.${extFromType}`;

    console.log("[UPLOAD] Fetched:", { fileName, contentType, size: buffer.length });
    return { buffer, contentType, fileName };
}

async function uploadImageToNotion(imageUrl: string) {
    const { buffer, contentType, fileName } = await fetchImageAsBuffer(imageUrl);

    console.log("[UPLOAD] Creating file upload:", { fileName, contentType, size: buffer.length });
    const createUpload: any = await notion.request({
        method: "post",
        path: "file_uploads",
        body: {
            file_name: fileName,
            content_type: contentType,
            file_size: buffer.length,
        },
    });

    const uploadUrl = createUpload.upload_url;
    const uploadId = createUpload.id;

    console.log("[UPLOAD] Create response:", {
        id: uploadId,
        has_upload_url: !!uploadUrl,
        full_response: JSON.stringify(createUpload, null, 2)
    });

    if (!uploadUrl || !uploadId) {
        throw new Error("Notion file upload did not return upload_url or id");
    }

    console.log("[UPLOAD] Uploading bytes to:", uploadUrl);

    // Use multipart/form-data with 'file' field
    const blob = new Blob([buffer], { type: contentType });
    const formData = new FormData();
    formData.append('file', blob, fileName);
    console.log("[UPLOAD] FormData created with file:", fileName, "size:", buffer.length);

    const uploadResp = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.NOTION_KEY}`,
            "Notion-Version": "2025-09-03",
        },
        body: formData,
    });

    console.log("[UPLOAD] POST response:", uploadResp.status, uploadResp.statusText);

    if (!uploadResp.ok) {
        const errorBody = await uploadResp.text();
        console.error("[UPLOAD] POST error body:", errorBody);
        throw new Error(`Upload failed: ${uploadResp.status} ${uploadResp.statusText} - ${errorBody}`);
    }

    // Parse /send response to check status
    const sendResponse = await uploadResp.json();
    const isAlreadyUploaded = sendResponse?.status === "uploaded";

    // For simple uploads (≤20 MiB), /send auto-completes - skip /complete
    if (isAlreadyUploaded) {
        return { uploadId, type: "file_upload" };
    }

    // For multi-part uploads, call /complete
    console.log("[UPLOAD] Completing upload:", uploadId);
    const completed: any = await notion.request({
        method: "post",
        path: `file_uploads/${uploadId}/complete`,
    });

    console.log("[UPLOAD] Complete response:", {
        has_file: !!completed?.file,
        file_url: completed?.file?.url,
        expiry_time: completed?.file?.expiry_time,
    });

    return { uploadId, type: "file_upload" };
}

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

        // Search for both pages and data_sources (default behavior)
        // Note: Notion's search API excludes databases - they must be accessed differently
        const response = await notion.search({ query });

        // Debug: log all returned objects
        console.log("=== SEARCH DEBUG ===");
        console.log("Query:", query);
        console.log("Search returned:", response.results.length, "items");
        response.results.forEach((item: any, index: number) => {
            console.log(`[${index}] object: ${item.object}, id: ${item.id}`);
            if (item.object === "data_source") {
                console.log("  → Data source found:", item);
            }
        });
        console.log("===================");

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

// List children (databases, pages, etc.) of a parent page
app.get("/children/:pageId", async (req, res) => {
    try {
        const pageId = req.params.pageId;

        console.log("=== CHILDREN DEBUG ===");
        console.log("Fetching children for page:", pageId);

        const response = await notion.blocks.children.list({
            block_id: pageId,
        });

        console.log("Children returned:", response.results.length, "blocks");

        // Filter for databases and pages
        const children = response.results
            .filter((block: any) => {
                const type = block.type;
                return type === "child_database" || type === "child_page";
            })
            .map((block: any) => {
                if (block.type === "child_database") {
                    // Child database blocks have title as a simple string
                    const title = block.child_database?.title || "(Untitled)";
                    return {
                        id: block.id,
                        type: "database",
                        title: title,
                        url: null,
                    };
                }
                // Child page blocks also have title as a simple string
                const title = block.child_page?.title || "(Untitled)";
                return {
                    id: block.id,
                    type: "page",
                    title: title,
                    url: null,
                };
            });

        console.log("Filtered children:", children);
        console.log("===================");

        return res.json(children);
    } catch (e: any) {
        console.error("Children fetch error:", e);
        return res.status(500).json({
            error: e?.message || "Failed to fetch children"
        });
    }
});

// Get a single data source with its properties
app.get("/data-source/:dataSourceId", async (req, res) => {
    try {
        const dataSourceId = req.params.dataSourceId;

        console.log("=== DATA SOURCE RETRIEVE DEBUG ===");
        console.log("Fetching data source:", dataSourceId);

        // Use the generic request method to call the data source endpoint
        const dataSource: any = await notion.request({
            method: 'get',
            path: `data_sources/${dataSourceId}`,
        });

        console.log("Data source retrieved:", dataSource.name);
        console.log("Properties:", Object.keys(dataSource.properties || {}).length);
        console.log("===================");

        return res.json(dataSource);
    } catch (e: any) {
        console.error("Data source retrieve error:", e);
        return res.status(500).json({
            error: e?.message || "Failed to retrieve data source"
        });
    }
});

// Get data sources for a database
app.get("/data-sources/:databaseId", async (req, res) => {
    try {
        const databaseId = req.params.databaseId;

        console.log("=== DATA SOURCES DEBUG ===");
        console.log("Fetching data sources for database:", databaseId);

        const database: any = await notion.databases.retrieve({
            database_id: databaseId
        });

        console.log("Database retrieved:", database.title);
        console.log("Data sources found:", database.data_sources?.length || 0);

        const dataSources = (database.data_sources || []).map((ds: any) => ({
            id: ds.id,
            type: "data_source",
            title: ds.name || "(Untitled data source)",
            url: null,
        }));

        console.log("Data sources:", dataSources);
        console.log("===================");

        return res.json(dataSources);
    } catch (e: any) {
        console.error("Data sources fetch error:", e);
        return res.status(500).json({
            error: e?.message || "Failed to fetch data sources"
        });
    }
});

// Create a child page in a parent page/database/data_source
app.post("/create-page", async (req, res) => {
    try {
        const parent_id = String(req.body?.parent_id ?? "").trim();
        const parent_type = String(req.body?.parent_type ?? "page").trim(); // "page", "database", or "data_source"
        const title = String(req.body?.title ?? "").trim();
        const custom_properties = req.body?.properties || {}; // Custom properties for data sources

        if (!parent_id) return res.status(400).json({ error: "parent_id is required" });
        if (!title) return res.status(400).json({ error: "title is required" });

        let parent: any;
        let properties: any;

        if (parent_type === "data_source") {
            // For data sources, use data_source_id as parent
            parent = { data_source_id: parent_id };
            // Use custom properties provided, or fallback to Name
            properties = Object.keys(custom_properties).length > 0
                ? custom_properties
                : {
                    Name: {
                        title: [
                            {
                                type: "text",
                                text: { content: title },
                            },
                        ],
                    },
                };
        } else if (parent_type === "database") {
            // For databases, use database_id as parent
            parent = { database_id: parent_id };
            // Database pages use "Name" property (or "title" in some cases)
            properties = {
                Name: {
                    title: [
                        {
                            type: "text",
                            text: { content: title },
                        },
                    ],
                },
            };
        } else {
            // For pages, use page_id as parent
            parent = { page_id: parent_id };
            properties = {
                title: {
                    title: [
                        {
                            type: "text",
                            text: { content: title },
                        },
                    ],
                },
            };
        }

        const response = await notion.pages.create({
            parent,
            properties,
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


// Append content (text + images) to a page
app.patch("/save", async (req, res) => {
    try {
        const page_id = String(req.body?.page_id ?? "").trim();
        const content = String(req.body?.content ?? "").trim();
        const images = Array.isArray(req.body?.images) ? req.body.images : [];

        if (!page_id) return res.status(400).json({ error: "Missing page_id" });
        if (!content && images.length === 0) {
            return res.status(400).json({ error: "Missing content or images" });
        }

        console.log("[SAVE] page_id:", page_id, "content:", content.slice(0, 80));
        console.log("[SAVE] images:", images.length);

        // Build blocks array: text paragraph + image blocks
        const blocks: any[] = [];

        if (content) {
            blocks.push({
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
            });
        }

        // Add image blocks (upload bytes to Notion)
        for (const imageUrl of images) {
            try {
                console.log("[SAVE] Processing image:", imageUrl);
                const uploadResult = await uploadImageToNotion(imageUrl);

                if (!uploadResult?.uploadId) {
                    throw new Error("Upload complete but uploadId missing");
                }

                console.log("[SAVE] ✓ Image uploaded successfully, adding file_upload block");

                // Use type: "file_upload" with the upload ID (per Notion docs)
                blocks.push({
                    object: "block",
                    type: "image",
                    image: {
                        type: "file_upload",
                        file_upload: {
                            id: uploadResult.uploadId,
                        },
                    },
                });
            } catch (err) {
                console.error("[SAVE] ✗ Image upload failed, falling back to external:", imageUrl, err);
                blocks.push({
                    object: "block",
                    type: "image",
                    image: {
                        type: "external",
                        external: { url: imageUrl },
                    },
                });
            }
        }

        const response = await notion.blocks.children.append({
            block_id: page_id, // page id is valid as a block_id
            children: blocks,
        });

        console.log("[SAVE] appended:", response?.results?.length, "blocks");
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