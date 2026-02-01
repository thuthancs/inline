import { Router } from "express";
import { getTitle } from "../helpers/getTitle.js";
import { getNotionClientFromSession, getSessionIdFromRequest } from "../services/notionClient.js";

const router = Router();

// Search Notion and return titles
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
                    console.log(page);

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
        console.log(results);
        return res.json(results);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Notion search failed" });
    }
});

export default router;
