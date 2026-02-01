import { Router } from "express";
import { getNotionClientFromSession, getSessionIdFromRequest } from "../services/notionClient.js";

const router = Router();

// Create a child page in a parent page/database/data_source
router.post("/", async (req, res) => {
    try {
        // Get session and create Notion client
        const sessionId = getSessionIdFromRequest(req);
        if (!sessionId) {
            return res.status(401).json({ error: "Missing session ID" });
        }

        const notion = await getNotionClientFromSession(sessionId);
        if (!notion) {
            return res.status(401).json({ error: "Invalid or expired session" });
        }

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
        console.log(response);
        return res.json(response);
    } catch (e: any) {
        console.error(e);
        // bubble Notion message if present (helps debugging)
        return res.status(e?.status || 500).json({
            error: e?.message || "Failed to create page",
        });
    }
});

export default router;
