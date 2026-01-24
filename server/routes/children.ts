import { Router } from "express";
import { notion } from "../services/notionClient.js";

const router = Router();

// List children (databases, pages, etc.) of a parent page
router.get("/:pageId", async (req, res) => {
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

export default router;

