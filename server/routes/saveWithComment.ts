import { Router } from "express";
import { notion } from "../services/notionClient.js";

const router = Router();

// Save content and add comment in one request
router.post("/", async (req, res) => {
    try {
        const page_id = String(req.body?.page_id ?? "").trim();
        const content = String(req.body?.content ?? "").trim();
        const comment_text = String(req.body?.comment_text ?? "").trim();

        if (!page_id) return res.status(400).json({ error: "Missing page_id" });
        if (!content) return res.status(400).json({ error: "Missing content" });
        if (!comment_text) return res.status(400).json({ error: "Missing comment_text" });

        console.log("[SAVE+COMMENT] page_id:", page_id);
        console.log("[SAVE+COMMENT] content:", content.slice(0, 50));
        console.log("[SAVE+COMMENT] comment:", comment_text.slice(0, 50));

        // Step 1: Append the text block as a quote
        const appendResponse = await notion.blocks.children.append({
            block_id: page_id,
            children: [
                {
                    object: "block",
                    type: "quote",
                    quote: {
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

        const blockId = appendResponse?.results?.[0]?.id;
        if (!blockId) {
            throw new Error("Failed to get block ID from append response");
        }

        console.log("[SAVE+COMMENT] ✓ Text saved, block ID:", blockId);

        // Step 2: Add comment to the block
        await notion.comments.create({
            parent: {
                // @ts-expect-error - Notion SDK types don't properly support block_id parent
                type: "block_id",
                block_id: blockId,
            },
            rich_text: [
                {
                    type: "text",
                    text: { content: comment_text },
                },
            ],
        });

        console.log("[SAVE+COMMENT] ✓ Comment added successfully");
        return res.json({ ok: true, blockId });
    } catch (e: any) {
        console.error("[SAVE+COMMENT] ✗ Error:", e?.body ?? e?.message ?? e);
        return res.status(e?.status || 500).json({
            error: e?.body?.message ?? e?.message ?? "Failed to save with comment"
        });
    }
});

export default router;

