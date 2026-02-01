import { Router } from "express";
import { uploadImageToNotion } from "../services/imageUpload.js";
import { getNotionClientFromSession, getSessionIdFromRequest } from "../services/notionClient.js";
import { getSession } from "../services/sessions.js";

const router = Router();

// Append content (text + images) to a page
router.patch("/", async (req, res) => {
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

        // Get access token for image upload
        const session = await getSession(sessionId);
        const accessToken = session?.accessToken;

        const page_id = String(req.body?.page_id ?? "").trim();
        const content = String(req.body?.content ?? "").trim();
        const images = Array.isArray(req.body?.images) ? req.body.images : [];

        if (!page_id) return res.status(400).json({ error: "Missing page_id" });
        if (!content && images.length === 0) {
            return res.status(400).json({ error: "Missing content or images" });
        }

        console.log("[SAVE] page_id:", page_id, "content:", content.slice(0, 80));
        console.log("[SAVE] images:", images.length);

        // Build blocks array: text quote + image blocks
        const blocks: any[] = [];

        if (content) {
            blocks.push({
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
            });
        }

        // Add image blocks (upload bytes to Notion)
        for (const imageUrl of images) {
            try {
                console.log("[SAVE] Processing image:", imageUrl);
                const uploadResult = await uploadImageToNotion(imageUrl, notion, accessToken!);

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

export default router;
