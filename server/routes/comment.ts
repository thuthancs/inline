import { Router } from "express";
import { getNotionClientFromSession, getSessionIdFromRequest } from "../services/notionClient.js";

const router = Router();

// Add a comment to a block
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

        const block_id = String(req.body?.block_id ?? "").trim();
        const comment_text = String(req.body?.comment_text ?? "").trim();

        console.log("[COMMENT] Creating comment on block:", block_id);
        console.log("[COMMENT] Comment text:", comment_text.slice(0, 50));

        if (!block_id) {
            return res.status(400).json({ error: "block_id is required" });
        }
        if (!comment_text) {
            return res.status(400).json({ error: "comment_text is required" });
        }

        const response = await notion.comments.create({
            parent: {
                // @ts-expect-error - Notion SDK types don't properly support block_id parent
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

        console.log("[COMMENT] ✓ Comment created successfully");
        return res.json(response);
    } catch (e: any) {
        console.error("[COMMENT] ✗ Error:", e?.body ?? e?.message ?? e);
        return res.status(e?.status || 500).json({
            error: e?.body?.message ?? e?.message ?? "Failed to add comment"
        });
    }
});

export default router;
