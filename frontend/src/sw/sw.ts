import { apiComment, apiSave } from "../api";
import type { Destination, SWMessage } from "../types";
import { DEST_KEY } from "../types";

console.log("Service worker loaded");

chrome.runtime.onMessage.addListener((msg: SWMessage, _sender, sendResponse) => {
    (async () => {
        console.log("SW received:", msg);

        const store = await chrome.storage.local.get(DEST_KEY);
        const dest = store[DEST_KEY] as Destination | undefined;

        if (!dest) {
            console.warn("No destination set");
            sendResponse({ ok: false, error: "NO_DESTINATION" });
            return;
        }

        const targetPageId =
            dest.mode === "append_to_selected"
                ? dest.pageId
                : dest.childPageId;

        if (!targetPageId) {
            console.warn("No target page id");
            sendResponse({ ok: false, error: "NO_TARGET_PAGE" });
            return;
        }

        if (msg.type === "SAVE_HIGHLIGHT") {
            console.log("Saving highlight to", targetPageId);
            console.log("Including images:", msg.payload.images?.length || 0);

            const resp = await apiSave(targetPageId, msg.payload.text, msg.payload.images);

            sendResponse({ ok: true, response: resp });
            return;
        }

        if (msg.type === "SAVE_IMAGE") {
            console.log("Saving image to", targetPageId);
            const resp = await apiSave(targetPageId, "", [msg.payload.imageUrl]);
            sendResponse({ ok: true, response: resp });
            return;
        }

        if (msg.type === "COMMENT_HIGHLIGHT") {
            console.log("Saving highlight + comment");

            const appendResp = await apiSave(targetPageId, msg.payload.text);
            const blockId = appendResp?.results?.[0]?.id;

            if (!blockId) {
                sendResponse({ ok: false, error: "NO_BLOCK_ID" });
                return;
            }

            await apiComment(blockId, msg.payload.comment);
            sendResponse({ ok: true });
            return;
        }

        sendResponse({ ok: false, error: "UNKNOWN_MESSAGE" });
    })().catch((err) => {
        console.error("SW error:", err);
        sendResponse({ ok: false, error: String(err?.message || err) });
    });

    // ✅ THIS LINE IS CRITICAL
    return true;
});
