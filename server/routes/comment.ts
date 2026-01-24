import { Router } from "express";
import { notion } from "../services/notionClient.js";

const router = Router();

// Add a comment to a block
router.post("/", async (req, res) => {
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
});

export default router;

