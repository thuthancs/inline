import { apiSave, apiSaveWithComment } from "../api";
import type { Destination, SWMessage } from "../types";
import { DEST_KEY } from "../types";

console.log("Service worker loaded at", new Date().toISOString());

// Open side panel when clicking the extension icon
chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
        chrome.sidePanel.open({ tabId: tab.id });
    }
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((msg: SWMessage, _sender, sendResponse) => {
    console.log("[SW] Received message:", msg.type, "at", new Date().toISOString());

    let responded = false;

    // Timeout handler
    const timeoutId = setTimeout(() => {
        if (!responded) {
            responded = true;
            console.error("[SW] Operation timed out after 15 seconds");
            sendResponse({ ok: false, error: "Operation timed out. Please try again." });
        }
    }, 15000);

    // Handle the message
    handleMessage(msg)
        .then((result) => {
            if (!responded) {
                responded = true;
                clearTimeout(timeoutId);
                console.log("[SW] Sending response:", result);
                sendResponse(result);
            }
        })
        .catch((err) => {
            if (!responded) {
                responded = true;
                clearTimeout(timeoutId);
                console.error("[SW] Error:", err);
                sendResponse({ ok: false, error: String(err?.message || err) });
            }
        });

    // Return true to indicate we'll call sendResponse asynchronously
    return true;
});

async function handleMessage(msg: SWMessage): Promise<{ ok: boolean; error?: string; response?: any }> {
    console.log("[SW] Step 1: Reading storage...");

    const store = await chrome.storage.local.get(DEST_KEY);
    const dest = store[DEST_KEY] as Destination | undefined;

    console.log("[SW] Step 2: Got destination:", dest ? dest.mode : "none");

    if (!dest) {
        console.warn("[SW] No destination set");
        return { ok: false, error: "NO_DESTINATION" };
    }

    const targetPageId =
        dest.mode === "append_to_selected"
            ? dest.pageId
            : dest.childPageId;

    console.log("[SW] Step 3: Target page ID:", targetPageId);

    if (!targetPageId) {
        console.warn("[SW] No target page id");
        return { ok: false, error: "NO_TARGET_PAGE" };
    }

    if (msg.type === "SAVE_HIGHLIGHT") {
        console.log("[SW] Step 4: Calling apiSave for highlight...");
        const resp = await apiSave(targetPageId, msg.payload.text, msg.payload.images);
        console.log("[SW] Step 5: apiSave complete");
        return { ok: true, response: resp };
    }

    if (msg.type === "SAVE_IMAGE") {
        console.log("[SW] Step 4: Calling apiSave for image...");
        const resp = await apiSave(targetPageId, "", [msg.payload.imageUrl]);
        console.log("[SW] Step 5: apiSave complete");
        return { ok: true, response: resp };
    }

    if (msg.type === "COMMENT_HIGHLIGHT") {
        console.log("[SW] Step 4: Saving with comment (combined endpoint)...");
        await apiSaveWithComment(targetPageId, msg.payload.text, msg.payload.comment);
        console.log("[SW] Step 5: Save + comment complete!");
        return { ok: true };
    }

    return { ok: false, error: "UNKNOWN_MESSAGE" };
}
